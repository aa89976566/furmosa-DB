import { redeemJarCode } from '@/lib/jar-exchange/redeem-code';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getPointsBalance } from '@/lib/jar-exchange/points';
import { prisma } from '@/lib/prisma';
import { bindLineUserToCustomer, findCustomerByLineUserId } from '@/lib/line/bind-customer';
import {
  LINE_BIND_HELP_TEXT,
  LINE_HELP_TEXT,
  LINE_WELCOME_TEXT,
  lineBindRequiredText,
  lineUnknownText,
} from '@/lib/line/messages';
import { parseLineUserText } from '@/lib/line/parse-message';
import {
  formatRewardMenuText,
  listActiveRewardsForLine,
  resolveRewardFromLineInput,
} from '@/lib/line/reward-menu';
import { replyLineText } from '@/lib/line/reply';
import { checkLineRateLimit } from '@/lib/line/rate-limit';

type LineMessageEvent = {
  type: 'message';
  message: { type: string; id: string; text?: string };
  source: { type: string; userId?: string };
  replyToken: string;
};

type LineFollowEvent = {
  type: 'follow';
  source: { type: string; userId?: string };
  replyToken: string;
};

export type LineWebhookEvent = LineMessageEvent | LineFollowEvent | { type: string; replyToken?: string };

export async function handleLineWebhookEvent(event: LineWebhookEvent): Promise<void> {
  if (event.type === 'follow' && 'replyToken' in event && event.replyToken) {
    const follow = event as LineFollowEvent;
    const lineUserId = follow.source?.userId;
    if (!lineUserId) return;
    await replyLineText(
      event.replyToken,
      `${LINE_WELCOME_TEXT}\n\n您的 LINE ID：${lineUserId}\n（後台綁定時可使用此 ID）\n\n${LINE_HELP_TEXT}`,
    );
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

  const parsed = parseLineUserText(msgEvent.message.text);
  const customer = await findCustomerByLineUserId(lineUserId);

  if (parsed.kind === 'help') {
    await replyLineText(replyToken, LINE_HELP_TEXT);
    return;
  }

  if (parsed.kind === 'bind_help') {
    await replyLineText(replyToken, LINE_BIND_HELP_TEXT);
    return;
  }

  if (parsed.kind === 'greeting') {
    const boundHint = customer
      ? `\n\n您已綁定：${customer.name}（${customer.customerId}）\n可直接傳返航序號或「點數」。`
      : `\n\n您尚未綁定，請傳「如何綁定」查看步驟。`;
    await replyLineText(replyToken, `${LINE_WELCOME_TEXT}${boundHint}`);
    return;
  }

  if (parsed.kind === 'status') {
    if (!customer) {
      await replyLineText(
        replyToken,
        `尚未綁定會員。\n\n${LINE_BIND_HELP_TEXT}\n\n您的 LINE ID：${lineUserId}`,
      );
      return;
    }
    const balance = await getPointsBalance(prisma, customer.id);
    await replyLineText(
      replyToken,
      `已綁定會員\n${customer.name}（${customer.customerId}）\n換罐點數：${balance} 點\n\n傳「獎勵」查看可兌換項目`,
    );
    return;
  }

  if (parsed.kind === 'bind') {
    const result = await bindLineUserToCustomer(lineUserId, parsed.identifier);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    await replyLineText(
      replyToken,
      `✅ 綁定成功\n${result.customerName}（${result.customerCode}）\n\n接下來您可以：\n• 直接傳 8 位返航序號兌換點數\n• 傳「點數」查餘額\n• 傳「獎勵」看可兌換項目\n\n您的 LINE ID：${lineUserId}`,
    );
    return;
  }

  if (parsed.kind === 'balance') {
    if (!customer) {
      await replyLineText(replyToken, lineBindRequiredText(lineUserId));
      return;
    }
    const balance = await getPointsBalance(prisma, customer.id);
    await replyLineText(
      replyToken,
      `${customer.name}（${customer.customerId}）\n目前換罐點數：${balance} 點\n\n傳「獎勵」可查看兌換項目`,
    );
    return;
  }

  if (parsed.kind === 'rewards_list') {
    const rewards = await listActiveRewardsForLine();
    if (!customer) {
      await replyLineText(
        replyToken,
        `${formatRewardMenuText(rewards)}\n\n⚠️ 兌換前請先綁定會員\n${LINE_BIND_HELP_TEXT}`,
      );
      return;
    }
    const balance = await getPointsBalance(prisma, customer.id);
    await replyLineText(replyToken, formatRewardMenuText(rewards, balance));
    return;
  }

  if (parsed.kind === 'redeem_reward') {
    if (!customer) {
      await replyLineText(replyToken, lineBindRequiredText(lineUserId));
      return;
    }
    const rewards = await listActiveRewardsForLine();
    const reward = await resolveRewardFromLineInput(parsed.target, rewards);
    if (!reward) {
      await replyLineText(
        replyToken,
        `找不到獎勵「${parsed.target}」。\n\n${formatRewardMenuText(rewards, await getPointsBalance(prisma, customer.id))}`,
      );
      return;
    }
    const result = await redeemRewardForCustomer(customer.id, reward.id);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    await replyLineText(
      replyToken,
      `🎁 兌換成功\n${reward.rewardName}\n消耗 ${result.pointsSpent} 點，餘額 ${result.balanceAfter} 點\n\n兌換編號：${result.redemptionCode}\n優惠券碼：${result.couponCode}\n\n請妥善保存券碼，至合作店家使用。`,
    );
    return;
  }

  if (parsed.kind === 'jar_code') {
    if (!customer) {
      await replyLineText(replyToken, lineBindRequiredText(lineUserId));
      return;
    }

    const result = await redeemJarCode(customer.id, parsed.code);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    await replyLineText(
      replyToken,
      `✅ 兌換成功\n序號 ${result.code}\n本次 +${result.pointsEarned} 點\n目前餘額 ${result.balanceAfter} 點\n\n${customer.name}（${customer.customerId}）\n\n傳「獎勵」可查看點數兌換項目`,
    );
    return;
  }

  await replyLineText(replyToken, lineUnknownText(lineUserId));
}
