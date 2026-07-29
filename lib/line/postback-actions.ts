import { GROOMING_COUPON_POINTS, getGroomingCouponDiscountForStore } from '@/lib/coupons/constants';
import {
  listCouponsForCustomer,
  redeemGroomingCouponForCustomer,
} from '@/lib/coupons/service';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import {
  BRAND_STORY,
  JAR_ENTER_BLOCKED_GUEST,
} from '@/lib/line/brand-worlds';
import { startJibaUnboxIntro } from '@/lib/line/campaigns/jiba-unbox/flow';
import {
  buildCouponListMessages,
  buildGroomingRedeemConfirmMessages,
  formatGroomingRedeemSuccessMessage,
} from '@/lib/line/coupon-menu';
import {
  formatHistoryStatusMessage,
  formatVaultStatusMessage,
  rewardProgress,
} from '@/lib/line/jar-deposit-copy';
import {
  buildRedeemPickerMessages,
  parseLinePostbackData,
} from '@/lib/line/flex-menu';
import {
  buildEnterCodePromptMessages,
  buildEventsCenterMessages,
  buildFrogProjectMessages,
  buildHomeHubMessages,
  buildJarExplainMessages,
  buildJarExplainTopicMessages,
  buildRegisterGateMessages,
  buildWorldHubMessages,
} from '@/lib/line/flex-hubs';
import { LINE_BTN } from '@/lib/line/line-copy';
import {
  handleRegisterPostback,
  startRegisterFlow,
} from '@/lib/line/register-from-chat';
import { clearLineChatSession, getLineChatSession } from '@/lib/line/chat-session';
import { replyLineMessage, replyLineText } from '@/lib/line/reply';
import { replyLineTextWithMenu, replyMenuHub } from '@/lib/line/reply-menu';
import { replyTriggerOnce } from '@/lib/line/trigger-throttle';
import {
  listActiveRewardsForLine,
  resolveRewardFromLineInput,
} from '@/lib/line/reward-menu';
import { listPartnerStoresFromDb } from '@/lib/stores/partner-stores';
import { formatLineStorePickerLabel } from '@/lib/coupons/constants';
import { prisma } from '@/lib/prisma';

async function loadVaultSnapshot(
  customer: NonNullable<Awaited<ReturnType<typeof findCustomerByLineUserId>>>,
) {
  const [stats, recent, coupons] = await Promise.all([
    getJarExchangeStatsForCustomer(customer.id),
    prisma.jarCode.findMany({
      where: { redeemedByCustomerId: customer.id, status: 'used' },
      orderBy: { redeemedAt: 'desc' },
      take: 10,
      select: { code: true },
    }),
    listCouponsForCustomer(customer.id),
  ]);
  const { needMore } = rewardProgress(stats.pointsBalance);
  return {
    customerName: customer.name,
    customerCode: customer.customerId,
    pointsBalance: stats.pointsBalance,
    jarsDeposited: stats.codesRedeemed,
    recentCodes: recent.map((r) => r.code),
    petName: customer.petName ?? null,
    canRedeemGrooming: needMore === 0 && stats.pointsBalance > 0,
    availableCouponCount: coupons.available.length,
    storeId: customer.storeId ?? customer.signupStore ?? null,
    storeName: customer.storeName ?? null,
  };
}

async function replyPartnerStores(replyToken: string) {
  const stores = await listPartnerStoresFromDb();
  const lines = [
    '【合作美容店】',
    '',
    ...stores.map((s) => `· ${formatLineStorePickerLabel(s.name, s.slug)}`),
    '',
    '開戶時選一間常去的店，之後折價券就會綁那間用喔。',
    '可折金額依門市而定，綁定後系統會跟你說～',
  ];
  await replyLineText(replyToken, lines.join('\n'));
}

function resolveCustomerStore(
  customer: NonNullable<Awaited<ReturnType<typeof findCustomerByLineUserId>>>,
) {
  const storeId = customer.storeId ?? customer.signupStore;
  const storeName = customer.storeName;
  return { storeId, storeName };
}

async function leaveJibaIfNeeded(lineUserId: string) {
  try {
    const chat = await getLineChatSession(lineUserId);
    if (chat?.flow === 'jiba_unbox') {
      await clearLineChatSession(lineUserId);
    }
  } catch (err) {
    console.error('[line] clear jiba session failed', err);
  }
}

async function replyChaosItem(
  replyToken: string,
  lineUserId: string,
  itemId: string,
  registered: boolean,
) {
  // 使用者主動點按鈕：一定要回，不可被 24h 節流靜默吃掉
  // 開箱任務：完整雞霸開箱對話（封面圖＋選項＋狀態機）
  if (itemId === 'chaos_unbox') {
    await startJibaUnboxIntro(replyToken, lineUserId);
    return;
  }

  // 離開開箱暫存，避免卡在狀態機裡
  await leaveJibaIfNeeded(lineUserId);

  // 嗷嗚計劃／舊青蛙鍵 → 青蛙誰在怕（獨立專案）
  if (itemId === 'chaos_aowu' || itemId === 'chaos_frog') {
    await replyLineMessage(replyToken, buildFrogProjectMessages({ registered }));
    return;
  }

  // 活動中心 → 沒梗了
  if (itemId === 'chaos_events') {
    await replyLineMessage(replyToken, buildEventsCenterMessages({ registered }));
    return;
  }

  await replyLineMessage(replyToken, buildWorldHubMessages('chaos', { registered }));
}

export async function handleLinePostback(
  replyToken: string,
  lineUserId: string,
  data: string,
): Promise<void> {
  const params = parseLinePostbackData(data);
  const action = params.get('jd');

  if (await handleRegisterPostback(replyToken, lineUserId, params)) return;

  let customer: Awaited<ReturnType<typeof findCustomerByLineUserId>> = null;
  try {
    customer = await findCustomerByLineUserId(lineUserId);
  } catch (err) {
    console.error('[line] findCustomerByLineUserId failed', err);
  }
  const registered = Boolean(customer);

  if (action === 'hub_jar') {
    await replyLineMessage(replyToken, buildWorldHubMessages('jar', { registered }), {
      lineUserId,
    });
    return;
  }
  if (action === 'hub_chaos') {
    await replyLineMessage(replyToken, buildWorldHubMessages('chaos', { registered }), {
      lineUserId,
    });
    return;
  }
  if (action === 'hub_wild' || action === 'hub_home') {
    await replyLineMessage(replyToken, buildHomeHubMessages(), { lineUserId });
    return;
  }

  if (action === 'jar_explain') {
    await replyLineMessage(replyToken, buildJarExplainMessages());
    return;
  }
  if (action === 'jar_explain_intro') {
    await replyLineMessage(replyToken, buildJarExplainTopicMessages('intro'));
    return;
  }
  if (action === 'jar_explain_flow') {
    await replyLineMessage(replyToken, buildJarExplainTopicMessages('flow'));
    return;
  }
  if (action === 'jar_faq') {
    await replyLineMessage(replyToken, buildJarExplainTopicMessages('faq'));
    return;
  }
  if (action === 'jar_stores' || action === 'wild_stores') {
    await replyPartnerStores(replyToken);
    return;
  }
  if (action === 'wild_story') {
    await replyLineText(replyToken, BRAND_STORY);
    return;
  }

  if (action === 'jar_reg' || action === 'reg') {
    const resumeAfter = params.get('next') === 'enter' ? 'enter_code' : null;
    await startRegisterFlow(replyToken, lineUserId, { resumeAfter });
    return;
  }

  if (action === 'jar_enter') {
    if (!customer) {
      await replyLineMessage(replyToken, buildRegisterGateMessages(JAR_ENTER_BLOCKED_GUEST));
      return;
    }
    await replyLineMessage(replyToken, buildEnterCodePromptMessages());
    return;
  }

  if (action === 'jar_vault' || action === 'vault' || action === 'jar_member') {
    if (!customer) {
      await replyLineMessage(replyToken, buildRegisterGateMessages(JAR_ENTER_BLOCKED_GUEST));
      return;
    }
    const snapshot = await loadVaultSnapshot(customer);
    await replyLineText(replyToken, formatVaultStatusMessage(snapshot));
    return;
  }

  if (action === 'jar_history') {
    if (!customer) {
      await replyLineMessage(replyToken, buildRegisterGateMessages(JAR_ENTER_BLOCKED_GUEST));
      return;
    }
    const snapshot = await loadVaultSnapshot(customer);
    await replyLineText(replyToken, formatHistoryStatusMessage(snapshot));
    return;
  }

  if (action?.startsWith('chaos_')) {
    await replyChaosItem(replyToken, lineUserId, action, registered);
    return;
  }

  // 舊鍵 → 導到正確世界（不混制度／活動）
  if (action === 'activity' || action === 'unbox') {
    await replyLineMessage(replyToken, buildWorldHubMessages('chaos', { registered }));
    return;
  }
  if (action === 'contact') {
    await replyLineMessage(replyToken, buildWorldHubMessages('wild', { registered }));
    return;
  }

  if (action === 'cp_list') {
    if (!customer) {
      await replyLineMessage(replyToken, buildRegisterGateMessages());
      return;
    }
    const groups = await listCouponsForCustomer(customer.id);
    await replyLineMessage(replyToken, buildCouponListMessages(groups));
    return;
  }

  if (action === 'cp_groom') {
    if (!customer) {
      await replyLineMessage(replyToken, buildRegisterGateMessages());
      return;
    }
    const { storeId, storeName } = resolveCustomerStore(customer);
    if (!storeId || !storeName) {
      await replyLineText(replyToken, '還沒綁合作店，跟我們說一聲幫你補。');
      return;
    }
    const stats = await getJarExchangeStatsForCustomer(customer.id);
    if (stats.pointsBalance < GROOMING_COUPON_POINTS) {
      const { progressLine } = rewardProgress(stats.pointsBalance);
      await replyLineText(
        replyToken,
        `還差一點。需 ${GROOMING_COUPON_POINTS} 點（目前 ${stats.pointsBalance}）。\n${progressLine}`,
      );
      return;
    }
    await replyLineMessage(
      replyToken,
      buildGroomingRedeemConfirmMessages({
        storeId,
        storeName,
        pointsBalance: stats.pointsBalance,
        discountAmount: getGroomingCouponDiscountForStore(storeId, storeName),
      }),
    );
    return;
  }

  if (action === 'cp_groom_ok') {
    if (!customer) {
      await replyLineText(replyToken, JAR_ENTER_BLOCKED_GUEST);
      return;
    }
    const result = await redeemGroomingCouponForCustomer(customer.id);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    await replyLineTextWithMenu(
      replyToken,
      lineUserId,
      formatGroomingRedeemSuccessMessage({
        couponCode: result.coupon.couponCode,
        storeName: result.coupon.storeName,
        discountAmount: result.coupon.discountAmount,
        expiresAt: result.coupon.expiresAt,
        balanceAfter: result.balanceAfter,
      }),
      { registered: true },
    );
    return;
  }

  if (action === 'redeem' || action === 'jar_rewards') {
    if (!customer) {
      await replyLineMessage(replyToken, buildRegisterGateMessages());
      return;
    }
    const rewards = await listActiveRewardsForLine();
    const stats = await getJarExchangeStatsForCustomer(customer.id);
    await replyLineMessage(replyToken, buildRedeemPickerMessages(rewards, stats.pointsBalance));
    return;
  }

  if (action === 'rd' && customer) {
    const rewards = await listActiveRewardsForLine();
    const reward = await resolveRewardFromLineInput(params.get('i') ?? '', rewards);
    if (!reward) {
      await replyLineText(replyToken, `找不到這個，再點「${LINE_BTN.redeem}」試試。`);
      return;
    }
    const result = await redeemRewardForCustomer(customer.id, reward.id);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    await replyLineText(
      replyToken,
      `換到了：${reward.rewardName}\n花 ${result.pointsSpent} 點，剩 ${result.balanceAfter}\n券碼：${result.couponCode}`,
    );
    return;
  }

  await replyTriggerOnce(lineUserId, 'menu_fallback', async () => {
    await replyMenuHub(replyToken, lineUserId, {
      body: '下面四格：一起野放／預約美容／換罐計劃／回家。',
      registered,
      alwaysReplyBody: false,
    });
  });
}
