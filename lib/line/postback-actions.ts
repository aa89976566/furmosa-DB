import { GROOMING_COUPON_POINTS, getGroomingCouponDiscountForStore } from '@/lib/coupons/constants';
import {
  listCouponsForCustomer,
  redeemGroomingCouponForCustomer,
} from '@/lib/coupons/service';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import {
  CHAOS_COPY,
  JAR_ENTER_BLOCKED_GUEST,
  JAR_ENTER_HINT_REGISTERED,
  JAR_EXPLAIN_TEXT,
} from '@/lib/line/brand-worlds';
import {
  buildCouponListMessages,
  buildGroomingRedeemConfirmMessages,
  formatGroomingRedeemSuccessMessage,
} from '@/lib/line/coupon-menu';
import {
  formatVaultStatusMessage,
  rewardProgress,
} from '@/lib/line/jar-deposit-copy';
import {
  buildRedeemPickerMessages,
  parseLinePostbackData,
} from '@/lib/line/flex-menu';
import {
  buildRegisterGateMessages,
  buildWorldHubMessages,
} from '@/lib/line/flex-hubs';
import {
  handleRegisterPostback,
  startRegisterFlow,
} from '@/lib/line/register-from-chat';
import { LINE_BTN } from '@/lib/line/line-copy';
import { replyLineMessage, replyLineText } from '@/lib/line/reply';
import { replyLineTextWithMenu, replyMenuHub } from '@/lib/line/reply-menu';
import { replyTriggerOnce } from '@/lib/line/trigger-throttle';
import {
  listActiveRewardsForLine,
  resolveRewardFromLineInput,
} from '@/lib/line/reward-menu';
import { prisma } from '@/lib/prisma';

async function loadVaultSnapshot(
  customer: NonNullable<Awaited<ReturnType<typeof findCustomerByLineUserId>>>,
) {
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
  };
}

function resolveCustomerStore(
  customer: NonNullable<Awaited<ReturnType<typeof findCustomerByLineUserId>>>,
) {
  const storeId = customer.storeId ?? customer.signupStore;
  const storeName = customer.storeName;
  return { storeId, storeName };
}

async function replyChaosItem(
  replyToken: string,
  lineUserId: string,
  itemId: string,
  registered: boolean,
) {
  const text = CHAOS_COPY[itemId];
  if (!text) {
    await replyLineMessage(replyToken, buildWorldHubMessages('chaos', { registered }));
    return;
  }
  await replyTriggerOnce(lineUserId, 'unboxing', async () => {
    await replyLineTextWithMenu(replyToken, lineUserId, text, { registered });
  });
}

export async function handleLinePostback(
  replyToken: string,
  lineUserId: string,
  data: string,
): Promise<void> {
  const params = parseLinePostbackData(data);
  const action = params.get('jd');

  if (await handleRegisterPostback(replyToken, lineUserId, params)) return;

  const customer = await findCustomerByLineUserId(lineUserId);
  const registered = Boolean(customer);

  if (action === 'hub_jar') {
    await replyLineMessage(replyToken, buildWorldHubMessages('jar', { registered }));
    return;
  }
  if (action === 'hub_chaos') {
    await replyLineMessage(replyToken, buildWorldHubMessages('chaos', { registered }));
    return;
  }
  if (action === 'hub_wild') {
    await replyLineMessage(replyToken, buildWorldHubMessages('wild', { registered }));
    return;
  }

  if (action === 'jar_explain') {
    await replyTriggerOnce(lineUserId, 'activity', async () => {
      await replyLineTextWithMenu(replyToken, lineUserId, JAR_EXPLAIN_TEXT, { registered });
    });
    return;
  }

  if (action === 'jar_reg' || action === 'reg') {
    await startRegisterFlow(replyToken, lineUserId);
    return;
  }

  if (action === 'jar_enter') {
    if (!customer) {
      await replyLineMessage(replyToken, buildRegisterGateMessages(JAR_ENTER_BLOCKED_GUEST));
      return;
    }
    await replyLineText(replyToken, JAR_ENTER_HINT_REGISTERED);
    return;
  }

  if (action === 'jar_vault' || action === 'vault') {
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

  if (action?.startsWith('chaos_')) {
    await replyChaosItem(replyToken, lineUserId, action, registered);
    return;
  }

  // 舊鍵相容
  if (action === 'activity') {
    await replyLineMessage(replyToken, buildWorldHubMessages('chaos', { registered }));
    return;
  }
  if (action === 'unbox') {
    await replyChaosItem(replyToken, lineUserId, 'chaos_aowu', registered);
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

  if (action === 'redeem') {
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
    await replyLineTextWithMenu(
      replyToken,
      lineUserId,
      `換到了：${reward.rewardName}\n花 ${result.pointsSpent} 點，剩 ${result.balanceAfter}\n券碼：${result.couponCode}`,
      { registered: true },
    );
    return;
  }

  await replyTriggerOnce(lineUserId, 'menu_fallback', async () => {
    await replyMenuHub(replyToken, lineUserId, {
      body: '三個入口：換罐計畫／一起搞事／野放中。',
      registered,
      alwaysReplyBody: false,
    });
  });
}
