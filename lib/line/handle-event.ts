import { redeemJarCode } from '@/lib/jar-exchange/redeem-code';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';
import { bindLineUserToCustomer, findCustomerByLineUserId } from '@/lib/line/bind-customer';
import { JAR_ENTER_BLOCKED_GUEST } from '@/lib/line/brand-worlds';
import {
  formatJarDepositSuccessMessage,
  formatQuickBalanceMessage,
  formatVaultStatusMessage,
  rewardProgress,
} from '@/lib/line/jar-deposit-copy';
import { buildRedeemPickerMessages } from '@/lib/line/flex-menu';
import {
  buildComicGroomingMessages,
  buildComicHomeMessages,
  buildComicJarMessages,
  buildComicRoamMessages,
} from '@/lib/line/comic-menu';
import {
  buildEventsCenterMessages,
  buildFrogProjectMessages,
  buildJarSuccessFlex,
  buildRegisterGateMessages,
  buildWorldHubMessages,
} from '@/lib/line/flex-hubs';
import {
  buildGuestWelcomeText,
  guestWelcomePromptMarks,
  LINE_BIND_HELP_TEXT,
  LINE_HELP_TEXT,
  lineBindRequiredText,
} from '@/lib/line/messages';
import { getOnboardingPromptFlags } from '@/lib/line/prompt-throttle';
import { handleLinePostback } from '@/lib/line/postback-actions';
import { parseLineUserText } from '@/lib/line/parse-message';
import { handleRegisterFlowMessage, startRegisterFlow } from '@/lib/line/register-from-chat';
import {
  handleJibaUnboxMessage,
  isJibaUnboxSessionActive,
  startJibaUnboxIntro,
} from '@/lib/line/campaigns/jiba-unbox/flow';
import { replyLineMessage, replyLineText } from '@/lib/line/reply';
import { replyLineTextWithMenu, replyMenuHub } from '@/lib/line/reply-menu';
import { checkLineRateLimit } from '@/lib/line/rate-limit';
import {
  isPassiveAutoReply,
  replyTriggerOnce,
} from '@/lib/line/trigger-throttle';
import {
  formatRewardMenuText,
  listActiveRewardsForLine,
  resolveRewardFromLineInput,
} from '@/lib/line/reward-menu';
import { prisma } from '@/lib/prisma';

type LineMessageEvent = {
  type: 'message';
  message: { type: string; id: string; text?: string };
  source: { type: string; userId?: string };
  replyToken: string;
};

type LinePostbackEvent = {
  type: 'postback';
  postback: { data: string };
  source: { type: string; userId?: string };
  replyToken: string;
};

type LineFollowEvent = {
  type: 'follow';
  source: { type: string; userId?: string };
  replyToken: string;
};

export type LineWebhookEvent =
  | LineMessageEvent
  | LinePostbackEvent
  | LineFollowEvent
  | { type: string; replyToken?: string };

type BoundCustomer = NonNullable<Awaited<ReturnType<typeof findCustomerByLineUserId>>>;

async function loadVaultSnapshot(customer: BoundCustomer) {
  const [stats, recent] = await Promise.all([
    getJarExchangeStatsForCustomer(customer.id),
    prisma.jarCode.findMany({
      where: { redeemedByCustomerId: customer.id, status: 'used' },
      orderBy: { redeemedAt: 'desc' },
      take: 5,
      select: { code: true },
    }),
  ]);
  return {
    customerName: customer.name,
    customerCode: customer.customerId,
    pointsBalance: stats.pointsBalance,
    jarsDeposited: stats.codesRedeemed,
    recentCodes: recent.map((r) => r.code),
    petName: customer.petName ?? null,
    storeId: customer.storeId ?? customer.signupStore ?? null,
    storeName: customer.storeName ?? null,
  };
}

export async function handleLineWebhookEvent(event: LineWebhookEvent): Promise<void> {
  if (event.type === 'follow' && 'replyToken' in event && event.replyToken) {
    const follow = event as LineFollowEvent;
    if (!follow.source?.userId) return;
    const lineUserId = follow.source.userId;
    await replyTriggerOnce(lineUserId, 'welcome', async () => {
      const promptFlags = await getOnboardingPromptFlags(lineUserId);
      await replyMenuHub(event.replyToken!, lineUserId, {
        body: buildGuestWelcomeText(promptFlags),
        registered: false,
        promptFlags,
        bodyPromptMarks: guestWelcomePromptMarks(promptFlags),
        alwaysReplyBody: false,
      });
    });
    return;
  }

  if (event.type === 'postback' && 'replyToken' in event && event.replyToken) {
    const pb = event as LinePostbackEvent;
    const lineUserId = pb.source?.userId;
    if (!lineUserId) return;

    const rl = checkLineRateLimit(`line:user:${lineUserId}`, { limit: 30, windowMs: 60_000 });
    if (!rl.ok) {
      await replyLineText(pb.replyToken, '操作有點密，晚點再試。');
      return;
    }

    await handleLinePostback(pb.replyToken, lineUserId, pb.postback.data);
    return;
  }

  if (event.type !== 'message') return;
  const msgEvent = event as LineMessageEvent;
  if (msgEvent.message.type !== 'text' || !msgEvent.message.text) return;

  const lineUserId = msgEvent.source.userId;
  const replyToken = msgEvent.replyToken;
  if (!lineUserId || !replyToken) return;

  const rl = checkLineRateLimit(`line:user:${lineUserId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    await replyLineText(replyToken, '操作有點密，晚點再試。');
    return;
  }

  // 開箱對話以 DB session 為準；優先於開戶流程，避免狀態被洗掉
  // campaign 表未就緒時不得讓整段 webhook 掛掉
  try {
    if (await isJibaUnboxSessionActive(lineUserId)) {
      if (
        await handleJibaUnboxMessage(
          replyToken,
          lineUserId,
          msgEvent.message.text,
          msgEvent.message.id,
        )
      ) {
        return;
      }
    }
  } catch (err) {
    console.error('[line] jiba session gate failed', err);
  }

  if (await handleRegisterFlowMessage(replyToken, lineUserId, msgEvent.message.text)) {
    return;
  }

  const parsed = parseLineUserText(msgEvent.message.text);
  const customer = await findCustomerByLineUserId(lineUserId);
  const registered = Boolean(customer);

  if (isPassiveAutoReply(parsed.kind)) {
    return;
  }

  if (parsed.kind === 'hub_jar') {
    await replyLineMessage(replyToken, buildComicJarMessages(registered));
    return;
  }
  if (parsed.kind === 'comic_roam') {
    await replyLineMessage(replyToken, buildComicRoamMessages(registered));
    return;
  }
  if (parsed.kind === 'comic_grooming') {
    await replyLineMessage(replyToken, buildComicGroomingMessages());
    return;
  }
  if (parsed.kind === 'comic_home') {
    await replyLineMessage(replyToken, buildComicHomeMessages(registered));
    return;
  }
  if (parsed.kind === 'hub_chaos') {
    await replyLineMessage(replyToken, buildWorldHubMessages('chaos', { registered }));
    return;
  }
  if (parsed.kind === 'hub_wild') {
    await replyLineMessage(replyToken, buildWorldHubMessages('wild', { registered }));
    return;
  }

  if (parsed.kind === 'help') {
    await replyTriggerOnce(lineUserId, 'help', async () => {
      await replyMenuHub(replyToken, lineUserId, {
        body: LINE_HELP_TEXT,
        registered,
        alwaysReplyBody: true,
      });
    });
    return;
  }

  if (parsed.kind === 'events_center') {
    // 主動入口：不節流
    await replyLineMessage(replyToken, buildEventsCenterMessages({ registered }));
    return;
  }

  if (parsed.kind === 'unboxing') {
    const t = msgEvent.message.text;
    // 「開箱任務」走完整對話狀態機（封面圖＋選項＋狀態機）
    if (t.includes('開箱')) {
      await startJibaUnboxIntro(replyToken, lineUserId);
      return;
    }
    // 嗷嗚計劃／青蛙誰在怕 → 青蛙專案（封面圖＋文案；網址後補）
    await replyLineMessage(replyToken, buildFrogProjectMessages({ registered }));
    return;
  }

  if (parsed.kind === 'bind_help') {
    await startRegisterFlow(replyToken, lineUserId);
    return;
  }

  if (parsed.kind === 'status' || parsed.kind === 'savings') {
    if (!customer) {
      await replyLineMessage(replyToken, buildRegisterGateMessages(JAR_ENTER_BLOCKED_GUEST));
      return;
    }
    const snapshot = await loadVaultSnapshot(customer);
    await replyLineTextWithMenu(replyToken, lineUserId, formatVaultStatusMessage(snapshot), {
      registered: true,
    });
    return;
  }

  if (parsed.kind === 'bind') {
    const result = await bindLineUserToCustomer(lineUserId, parsed.identifier);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    await replyLineTextWithMenu(
      replyToken,
      lineUserId,
      `開戶對上了！\n${result.customerName}\n\n罐底 8 碼直接傳上來。`,
      { registered: true },
    );
    return;
  }

  if (parsed.kind === 'balance') {
    if (!customer) {
      await replyLineMessage(replyToken, buildRegisterGateMessages(lineBindRequiredText()));
      return;
    }
    await replyLineTextWithMenu(
      replyToken,
      lineUserId,
      formatQuickBalanceMessage(await loadVaultSnapshot(customer)),
      { registered: true },
    );
    return;
  }

  if (parsed.kind === 'rewards_list') {
    const rewards = await listActiveRewardsForLine();
    if (!customer) {
      await replyMenuHub(replyToken, lineUserId, {
        body: `${formatRewardMenuText(rewards)}\n\n⚠️ 先開戶才能換。`,
        registered: false,
        alwaysReplyBody: true,
      });
      return;
    }
    const stats = await getJarExchangeStatsForCustomer(customer.id);
    await replyLineMessage(replyToken, buildRedeemPickerMessages(rewards, stats.pointsBalance));
    return;
  }

  if (parsed.kind === 'redeem_reward') {
    if (!customer) {
      await replyLineMessage(replyToken, buildRegisterGateMessages(lineBindRequiredText()));
      return;
    }
    const rewards = await listActiveRewardsForLine();
    const reward = await resolveRewardFromLineInput(parsed.target, rewards);
    if (!reward) {
      const snapshot = await loadVaultSnapshot(customer);
      await replyLineText(
        replyToken,
        `找不到「${parsed.target}」。\n\n${formatRewardMenuText(rewards, snapshot.pointsBalance)}`,
      );
      return;
    }
    const result = await redeemRewardForCustomer(customer.id, reward.id);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    await replyLineTextWithMenu(
      replyToken,
      lineUserId,
      `換到了：${reward.rewardName}\n花 ${result.pointsSpent} 點，剩 ${result.balanceAfter}\n券碼：${result.couponCode}`,
      { registered: true },
    );
    return;
  }

  if (parsed.kind === 'jar_code') {
    if (!customer) {
      await replyLineMessage(replyToken, buildRegisterGateMessages(JAR_ENTER_BLOCKED_GUEST));
      return;
    }

    const result = await redeemJarCode(customer.id, parsed.code);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    const snapshot = await loadVaultSnapshot(customer);
    const { progressLine } = rewardProgress(result.balanceAfter);
    await replyLineMessage(replyToken, [
      {
        type: 'text',
        text: formatJarDepositSuccessMessage({
          ...snapshot,
          pointsBalance: result.balanceAfter,
          pointsEarnedThisTime: result.pointsEarned,
          code: result.code,
        }),
      },
      buildJarSuccessFlex({
        code: result.code,
        pointsEarned: result.pointsEarned,
        pointsBalance: result.balanceAfter,
        jarsDeposited: snapshot.jarsDeposited,
        progressLine,
      }),
    ]);
    return;
  }
}
