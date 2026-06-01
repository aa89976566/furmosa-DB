import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import { formatSavingsStatusMessage } from '@/lib/line/jar-deposit-copy';
import {
  buildRedeemPickerMessages,
  parseLinePostbackData,
} from '@/lib/line/flex-menu';
import {
  handleRegisterPostback,
  startRegisterFlow,
} from '@/lib/line/register-from-chat';
import { LINE_BTN } from '@/lib/line/line-copy';
import { replyLineMessage, replyLineText } from '@/lib/line/reply';
import { replyLineTextWithMenu, replyMenuHub } from '@/lib/line/reply-menu';
import {
  listActiveRewardsForLine,
  resolveRewardFromLineInput,
} from '@/lib/line/reward-menu';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';

async function loadSnapshot(customer: NonNullable<Awaited<ReturnType<typeof findCustomerByLineUserId>>>) {
  const stats = await getJarExchangeStatsForCustomer(customer.id);
  return {
    customerName: customer.name,
    customerCode: customer.customerId,
    pointsBalance: stats.pointsBalance,
    jarsDeposited: stats.codesRedeemed,
  };
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
    await replyLineTextWithMenu(
      replyToken,
      lineUserId,
      formatSavingsStatusMessage(snapshot),
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

  await replyMenuHub(replyToken, lineUserId, {
    body: '可從下方選單操作，或直接傳 8 位空罐序號存罐～',
    registered: Boolean(customer),
  });
}
