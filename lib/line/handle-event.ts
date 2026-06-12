import { redeemJarCode } from '@/lib/jar-exchange/redeem-code';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';
import { bindLineUserToCustomer, findCustomerByLineUserId } from '@/lib/line/bind-customer';
import {
  formatJarDepositSuccessMessage,
  formatQuickBalanceMessage,
  formatSavingsStatusMessage,
} from '@/lib/line/jar-deposit-copy';
import { buildRedeemPickerMessages } from '@/lib/line/flex-menu';
import { LINE_UNBOXING_INFO } from '@/lib/line/line-copy';
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
import { handleRegisterFlowMessage } from '@/lib/line/register-from-chat';
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

async function loadDepositSnapshot(customer: BoundCustomer) {
  const stats = await getJarExchangeStatsForCustomer(customer.id);
  return {
    customerName: customer.name,
    customerCode: customer.customerId,
    pointsBalance: stats.pointsBalance,
    jarsDeposited: stats.codesRedeemed,
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
      await replyLineText(pb.replyToken, '操作過於頻繁，請稍後再試');
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
    await replyLineText(replyToken, '操作過於頻繁，請稍後再試');
    return;
  }

  if (await handleRegisterFlowMessage(replyToken, lineUserId, msgEvent.message.text)) {
    return;
  }

  const parsed = parseLineUserText(msgEvent.message.text);
  const customer = await findCustomerByLineUserId(lineUserId);

  // 被動觸發：不自動回覆
  if (isPassiveAutoReply(parsed.kind)) {
    return;
  }

  if (parsed.kind === 'help') {
    await replyTriggerOnce(lineUserId, 'help', async () => {
      await replyMenuHub(replyToken, lineUserId, {
        body: LINE_HELP_TEXT,
        registered: Boolean(customer),
        alwaysReplyBody: true,
      });
    });
    return;
  }

  if (parsed.kind === 'unboxing') {
    await replyTriggerOnce(lineUserId, 'unboxing', async () => {
      await replyLineTextWithMenu(replyToken, lineUserId, LINE_UNBOXING_INFO, {
        registered: Boolean(customer),
      });
    });
    return;
  }

  if (parsed.kind === 'bind_help') {
    await replyTriggerOnce(lineUserId, 'bind_help', async () => {
      await replyMenuHub(replyToken, lineUserId, {
        body: LINE_BIND_HELP_TEXT,
        registered: false,
        alwaysReplyBody: true,
      });
    });
    return;
  }

  if (parsed.kind === 'status' || parsed.kind === 'savings') {
    if (!customer) {
      await replyMenuHub(replyToken, lineUserId, {
        body: lineBindRequiredText(),
        registered: false,
        alwaysReplyBody: true,
      });
      return;
    }
    const snapshot = await loadDepositSnapshot(customer);
    const promptFlags = await getOnboardingPromptFlags(lineUserId);
    const showJarHint = promptFlags.showJar && snapshot.jarsDeposited === 0;
    await replyLineTextWithMenu(
      replyToken,
      lineUserId,
      formatSavingsStatusMessage(snapshot, { showJarHint }),
      {
        registered: true,
        promptFlags,
        bodyPromptMarks: showJarHint ? { jar: true } : undefined,
      },
    );
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
      `✅ 開戶成功！\n${result.customerName}\n\n傳 8 位序號存罐，或點下方按鈕。`,
      { registered: true },
    );
    return;
  }

  if (parsed.kind === 'balance') {
    if (!customer) {
      await replyMenuHub(replyToken, lineUserId, {
        body: lineBindRequiredText(),
        registered: false,
        alwaysReplyBody: true,
      });
      return;
    }
    await replyLineTextWithMenu(
      replyToken,
      lineUserId,
      formatQuickBalanceMessage(await loadDepositSnapshot(customer)),
      { registered: true },
    );
    return;
  }

  if (parsed.kind === 'rewards_list') {
    const rewards = await listActiveRewardsForLine();
    if (!customer) {
      await replyMenuHub(replyToken, lineUserId, {
        body: `${formatRewardMenuText(rewards)}\n\n⚠️ 請先點「幫毛孩開戶」。`,
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
      await replyMenuHub(replyToken, lineUserId, {
        body: lineBindRequiredText(),
        registered: false,
        alwaysReplyBody: true,
      });
      return;
    }
    const rewards = await listActiveRewardsForLine();
    const reward = await resolveRewardFromLineInput(parsed.target, rewards);
    if (!reward) {
      const snapshot = await loadDepositSnapshot(customer);
      await replyLineText(
        replyToken,
        `找不到獎勵「${parsed.target}」。\n\n${formatRewardMenuText(rewards, snapshot.pointsBalance)}`,
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
      `🎁 兌換成功\n${reward.rewardName}\n消耗 ${result.pointsSpent} 點，餘額 ${result.balanceAfter} 點\n\n優惠券碼：${result.couponCode}`,
      { registered: true },
    );
    return;
  }

  if (parsed.kind === 'jar_code') {
    if (!customer) {
      await replyMenuHub(replyToken, lineUserId, {
        body: lineBindRequiredText(),
        registered: false,
        alwaysReplyBody: true,
      });
      return;
    }

    const result = await redeemJarCode(customer.id, parsed.code);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    const stats = await getJarExchangeStatsForCustomer(customer.id);
    await replyLineTextWithMenu(
      replyToken,
      lineUserId,
      formatJarDepositSuccessMessage({
        customerName: customer.name,
        customerCode: customer.customerId,
        pointsBalance: result.balanceAfter,
        jarsDeposited: stats.codesRedeemed,
        pointsEarnedThisTime: result.pointsEarned,
        code: result.code,
      }),
      { registered: true },
    );
    return;
  }

  // 其餘無法辨識的訊息：不自動回覆
}
