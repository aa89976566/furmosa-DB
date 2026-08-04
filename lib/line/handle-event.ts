import { previewJarCodeForRedeem } from '@/lib/jar-exchange/redeem-code';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';
import { bindLineUserToCustomer, findCustomerByLineUserId } from '@/lib/line/bind-customer';
import { JAR_ENTER_BLOCKED_GUEST } from '@/lib/line/brand-worlds';
import { clearLineChatSession } from '@/lib/line/chat-session';
import { runAfterReply } from '@/lib/line/defer';
import {
  formatQuickBalanceMessage,
  formatVaultStatusMessage,
} from '@/lib/line/jar-deposit-copy';
import { buildRedeemPickerMessages } from '@/lib/line/flex-menu';
import { buildJarFlavourPickerMessages } from '@/lib/line/jar-flavour-picker';
import {
  buildComicGroomingMessages,
  buildComicHomeMessages,
  buildComicJarMessages,
  buildComicRoamMessages,
} from '@/lib/line/comic-menu';
import {
  buildEventsCenterMessages,
  buildFrogProjectMessages,
  buildJarExplainTopicMessages,
  buildJarStartMessages,
  buildRegisterGateMessages,
} from '@/lib/line/flex-hubs';
import {
  getRefillPlanSettings,
  listActiveRefillFlavours,
} from '@/lib/jar-exchange/refill-flavours';
import {
  buildJarIntroMessages,
  buildRefillFlavoursListMessages,
} from '@/lib/line/refill-intro-flex';
import { getLiffUrlIfConfigured } from '@/lib/line/liff-config';
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
import { SESSION_BYPASS_KINDS } from '@/lib/line/session-leave';

const RICH_MENU_HUB_KINDS = new Set([
  'hub_jar',
  'comic_roam',
  'comic_grooming',
  'comic_home',
  'hub_chaos',
  'hub_wild',
]);

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

  const parsed = parseLineUserText(msgEvent.message.text);

  // Rich Menu 四格／世界捷徑：不經開箱／開戶 session，且先回選單（零 DB）再背景補卡
  if (RICH_MENU_HUB_KINDS.has(parsed.kind)) {
    runAfterReply(
      clearLineChatSession(lineUserId).catch((err) => {
        console.error('[line] clear session on rich-menu failed', err);
      }),
    );

    try {
      if (parsed.kind === 'hub_jar') {
        // 「線上預購換罐」已併進選單（有 LINE_LIFF_ID_REFILL 時），不再依賴背景 Push
        await replyLineMessage(replyToken, buildComicJarMessages(), {
          lineUserId,
        });
      } else if (parsed.kind === 'comic_roam' || parsed.kind === 'hub_chaos') {
        await replyLineMessage(replyToken, buildComicRoamMessages(), {
          lineUserId,
        });
      } else if (parsed.kind === 'comic_grooming') {
        await replyLineMessage(replyToken, buildComicGroomingMessages(), {
          lineUserId,
        });
      } else if (parsed.kind === 'comic_home' || parsed.kind === 'hub_wild') {
        await replyLineMessage(replyToken, buildComicHomeMessages(), {
          lineUserId,
        });
      }
    } catch (err) {
      console.error('[line] rich-menu hub reply failed', parsed.kind, err);
      const safeText =
        parsed.kind === 'hub_jar'
          ? '換罐計劃在這裡～回「換罐計劃是什麼」或「開戶」也可以繼續喔。'
          : '選單剛卡一下，再點一次，或直接打字跟我說要什麼。';
      try {
        await replyLineText(replyToken, safeText);
      } catch (err2) {
        console.error('[line] rich-menu text fallback failed', err2);
        throw err;
      }
    }
    return;
  }

  // 換罐選單捷徑（介紹／Q&A／開戶…）：略過開箱／開戶 session
  // 否則開箱「選門市」會把「介紹」當成店名候選
  const bypassSession = SESSION_BYPASS_KINDS.has(parsed.kind);
  if (bypassSession) {
    // bind_help（立即開戶）會建立 register session，不可先 clear 掉
    if (parsed.kind !== 'bind_help') {
      runAfterReply(
        clearLineChatSession(lineUserId).catch((err) => {
          console.error('[line] clear session on jar shortcut failed', err);
        }),
      );
    }
  } else {
    // 開戶進行中優先於開箱：暱稱／手機不可被 CONFIRM_STORE 吃掉
    try {
      if (await handleRegisterFlowMessage(replyToken, lineUserId, msgEvent.message.text)) {
        return;
      }
    } catch (err) {
      console.error('[line] register flow gate failed', err);
    }

    // 開箱對話以 DB session 為準；campaign 表未就緒時不得讓整段 webhook 掛掉
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
  }

  if (isPassiveAutoReply(parsed.kind)) {
    return;
  }

  // 介紹／FAQ／口味：先回內容（讀取有短 TTL 快取、不再 seed），會員查詢並行
  if (
    parsed.kind === 'jar_explain_intro' ||
    parsed.kind === 'jar_explain' ||
    parsed.kind === 'jar_explain_flow' ||
    parsed.kind === 'jar_explain_faq' ||
    parsed.kind === 'refill_flavours'
  ) {
    try {
      if (parsed.kind === 'jar_explain_flow') {
        await replyLineMessage(replyToken, await buildJarExplainTopicMessages('flow'), {
          lineUserId,
        });
        return;
      }
      if (parsed.kind === 'jar_explain_faq') {
        await replyLineMessage(replyToken, await buildJarExplainTopicMessages('faq'), {
          lineUserId,
        });
        return;
      }
      if (parsed.kind === 'refill_flavours') {
        await replyLineMessage(replyToken, await buildRefillFlavoursListMessages(), {
          lineUserId,
        });
        return;
      }

      // 會員查詢與口味／設定讀取並行（讀取有 60s 快取、不再 seed）
      const [customer] = await Promise.all([
        findCustomerByLineUserId(lineUserId).catch((err) => {
          console.error('[line] findCustomerByLineUserId failed; treat as guest', err);
          return null;
        }),
        getRefillPlanSettings(),
        listActiveRefillFlavours(),
      ]);
      await replyLineMessage(
        replyToken,
        await buildJarIntroMessages({ registered: Boolean(customer) }),
        { lineUserId },
      );
      return;
    } catch (err) {
      console.error('[line] jar explain fast path failed', parsed.kind, err);
      throw err;
    }
  }

  // DB 短暫異常時仍要能回功能訊息，不可整段掉進兜底句
  let customer: BoundCustomer | null = null;
  try {
    customer = await findCustomerByLineUserId(lineUserId);
  } catch (err) {
    console.error('[line] findCustomerByLineUserId failed; treat as guest', err);
  }
  const registered = Boolean(customer);
  if (parsed.kind === 'jar_start') {
    await replyLineMessage(
      replyToken,
      buildJarStartMessages({
        registered,
        customerName: customer?.name ?? null,
        refillLiffUrl: getLiffUrlIfConfigured('refill'),
      }),
      { lineUserId },
    );
    return;
  }
  if (parsed.kind === 'jar_enter') {
    await handleLinePostback(replyToken, lineUserId, 'jd=jar_enter');
    return;
  }
  if (parsed.kind === 'redeem_coupon') {
    // 與 postback jd=cp_groom 同一套美容折價券兌換
    await handleLinePostback(replyToken, lineUserId, 'jd=cp_groom');
    return;
  }
  if (parsed.kind === 'jar_stores') {
    // 與 postback jd=jar_stores 同一套清單（不列折價金額）
    await handleLinePostback(replyToken, lineUserId, 'jd=jar_stores');
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

    const preview = await previewJarCodeForRedeem(parsed.code);
    if (!preview.ok) {
      await replyLineText(replyToken, preview.error);
      return;
    }
    const flavours = await listActiveRefillFlavours();
    await replyLineMessage(
      replyToken,
      buildJarFlavourPickerMessages({ code: preview.code, flavours }),
    );
    return;
  }
}
