import { GROOMING_COUPON_POINTS, getGroomingCouponDiscountForStore } from '@/lib/coupons/constants';
import {
  listCouponsForCustomer,
  redeemGroomingCouponForCustomer,
} from '@/lib/coupons/service';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import {
  buildCouponListMessages,
  buildGroomingRedeemConfirmMessages,
  formatGroomingRedeemSuccessMessage,
} from '@/lib/line/coupon-menu';
import { formatSavingsStatusMessage } from '@/lib/line/jar-deposit-copy';
import { buildRedeemPickerMessages, parseLinePostbackData } from '@/lib/line/flex-menu';
import {
  handleRegisterPostback,
  startRegisterFlow,
} from '@/lib/line/register-from-chat';
import {
  LINE_ACTIVITY_INFO,
  LINE_BTN,
  LINE_CONTACT_INFO,
  LINE_UNBOXING_INFO,
} from '@/lib/line/line-copy';
import { replyLineMessage, replyLineText } from '@/lib/line/reply';
import { getOnboardingPromptFlags } from '@/lib/line/prompt-throttle';
import { replyLineTextWithMenu, replyMenuHub } from '@/lib/line/reply-menu';
import { replyTriggerOnce } from '@/lib/line/trigger-throttle';
import {
  listActiveRewardsForLine,
  resolveRewardFromLineInput,
} from '@/lib/line/reward-menu';

async function loadSnapshot(customer: NonNullable<Awaited<ReturnType<typeof findCustomerByLineUserId>>>) {
  const stats = await getJarExchangeStatsForCustomer(customer.id);
  return {
    customerName: customer.name,
    customerCode: customer.customerId,
    pointsBalance: stats.pointsBalance,
    jarsDeposited: stats.codesRedeemed,
  };
}

function resolveCustomerStore(customer: NonNullable<Awaited<ReturnType<typeof findCustomerByLineUserId>>>) {
  const storeId = customer.storeId ?? customer.signupStore;
  const storeName = customer.storeName;
  return { storeId, storeName };
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

  if (action === 'reg') {
    await startRegisterFlow(replyToken, lineUserId);
    return;
  }

  if (action === 'activity') {
    await replyTriggerOnce(lineUserId, 'activity', async () => {
      await replyLineTextWithMenu(replyToken, lineUserId, LINE_ACTIVITY_INFO, {
        registered: Boolean(customer),
      });
    });
    return;
  }

  if (action === 'unbox') {
    await replyTriggerOnce(lineUserId, 'unboxing', async () => {
      await replyLineTextWithMenu(replyToken, lineUserId, LINE_UNBOXING_INFO, {
        registered: Boolean(customer),
      });
    });
    return;
  }

  if (action === 'contact') {
    await replyTriggerOnce(lineUserId, 'contact', async () => {
      await replyLineTextWithMenu(replyToken, lineUserId, LINE_CONTACT_INFO, {
        registered: Boolean(customer),
      });
    });
    return;
  }

  if (action === 'vault') {
    if (!customer) {
      await replyLineTextWithMenu(
        replyToken,
        lineUserId,
        `還沒開戶，請先點「${LINE_BTN.register}」。`,
        { registered: false },
      );
      return;
    }
    const snapshot = await loadSnapshot(customer);
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

  if (action === 'cp_list') {
    if (!customer) {
      await replyLineTextWithMenu(
        replyToken,
        lineUserId,
        `還沒開戶，請先點「${LINE_BTN.register}」。`,
        { registered: false },
      );
      return;
    }
    const groups = await listCouponsForCustomer(customer.id);
    await replyLineMessage(replyToken, buildCouponListMessages(groups));
    return;
  }

  if (action === 'cp_groom') {
    if (!customer) {
      await replyLineTextWithMenu(
        replyToken,
        lineUserId,
        `還沒開戶，請先點「${LINE_BTN.register}」。`,
        { registered: false },
      );
      return;
    }
    const { storeId, storeName } = resolveCustomerStore(customer);
    if (!storeId || !storeName) {
      await replyLineText(replyToken, '尚未綁定合作美容院，請聯絡客服協助。');
      return;
    }
    const stats = await getJarExchangeStatsForCustomer(customer.id);
    if (stats.pointsBalance < GROOMING_COUPON_POINTS) {
      await replyLineText(
        replyToken,
        `點數不足，需 ${GROOMING_COUPON_POINTS} 點才能兌換（目前 ${stats.pointsBalance} 點）。`,
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
      await replyLineText(replyToken, `還沒開戶，請先點「${LINE_BTN.register}」。`);
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
      await replyLineTextWithMenu(
        replyToken,
        lineUserId,
        `還沒開戶，請先點「${LINE_BTN.register}」。`,
        { registered: false },
      );
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
      await replyLineText(replyToken, `找不到此獎勵，請再點「${LINE_BTN.redeem}」重試。`);
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
      `🎁 兌換成功\n${reward.rewardName}\n消耗 ${result.pointsSpent} 點，餘額 ${result.balanceAfter} 點\n\n優惠券碼：${result.couponCode}\n請妥善保存，至合作店家使用。`,
      { registered: true },
    );
    return;
  }

  await replyTriggerOnce(lineUserId, 'menu_fallback', async () => {
    const promptFlags = await getOnboardingPromptFlags(lineUserId);
    const body = promptFlags.showJar
      ? '可從下方選單操作，或直接傳 8 位空罐序號存罐～'
      : '可從下方選單操作。';
    await replyMenuHub(replyToken, lineUserId, {
      body,
      registered: Boolean(customer),
      promptFlags,
      bodyPromptMarks: promptFlags.showJar ? { jar: true } : undefined,
      alwaysReplyBody: false,
    });
  });
}
