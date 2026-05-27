import { redeemJarCode } from '@/lib/jar-exchange/redeem-code';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';
import { prisma } from '@/lib/prisma';
import { bindLineUserToCustomer, findCustomerByLineUserId } from '@/lib/line/bind-customer';
import {
  formatJarDepositSuccessMessage,
  formatQuickBalanceMessage,
  formatSavingsStatusMessage,
} from '@/lib/line/jar-deposit-copy';
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
    const lineUserId = follow.source?.userId;
    if (!lineUserId) return;
    await replyLineText(event.replyToken, `${LINE_WELCOME_TEXT}\n\n${LINE_HELP_TEXT}`);
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
    if (customer) {
      const snapshot = await loadDepositSnapshot(customer);
      await replyLineText(
        replyToken,
        `${LINE_WELCOME_TEXT}\n\n${formatQuickBalanceMessage(snapshot)}\n\n有空罐就傳序號存進小金庫～`,
      );
      return;
    }
    await replyLineText(
      replyToken,
      `${LINE_WELCOME_TEXT}\n\n您還沒開戶，傳「如何綁定」或「開戶存罐罐」就能開始。`,
    );
    return;
  }

  if (parsed.kind === 'status') {
    if (!customer) {
      await replyLineText(
        replyToken,
        `還沒開戶存罐罐。\n\n${LINE_BIND_HELP_TEXT}\n\n您的 LINE ID：${lineUserId}`,
      );
      return;
    }
    await replyLineText(replyToken, formatSavingsStatusMessage(await loadDepositSnapshot(customer)));
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
      `✅ 開戶成功！\n${result.customerName}（${result.customerCode}）\n\n接下來：\n• 傳 8 位序號 → 存罐入帳\n• 小金庫 → 看累積幾罐\n• 獎勵 → 看能換什麼`,
    );
    return;
  }

  if (parsed.kind === 'balance') {
    if (!customer) {
      await replyLineText(replyToken, lineBindRequiredText());
      return;
    }
    await replyLineText(replyToken, formatQuickBalanceMessage(await loadDepositSnapshot(customer)));
    return;
  }

  if (parsed.kind === 'savings') {
    if (!customer) {
      await replyLineText(replyToken, lineBindRequiredText());
      return;
    }
    await replyLineText(replyToken, formatSavingsStatusMessage(await loadDepositSnapshot(customer)));
    return;
  }

  if (parsed.kind === 'rewards_list') {
    const rewards = await listActiveRewardsForLine();
    if (!customer) {
      await replyLineText(
        replyToken,
        `${formatRewardMenuText(rewards)}\n\n⚠️ 兌換前先開戶存罐罐\n${LINE_BIND_HELP_TEXT}`,
      );
      return;
    }
    const snapshot = await loadDepositSnapshot(customer);
    await replyLineText(replyToken, formatRewardMenuText(rewards, snapshot.pointsBalance));
    return;
  }

  if (parsed.kind === 'redeem_reward') {
    if (!customer) {
      await replyLineText(replyToken, lineBindRequiredText());
      return;
    }
    const rewards = await listActiveRewardsForLine();
    const reward = await resolveRewardFromLineInput(parsed.target, rewards);
    const snapshot = await loadDepositSnapshot(customer);
    if (!reward) {
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
    await replyLineText(
      replyToken,
      `🎁 兌換成功\n${reward.rewardName}\n消耗 ${result.pointsSpent} 罐罐點數，餘額 ${result.balanceAfter} 點\n\n兌換編號：${result.redemptionCode}\n優惠券碼：${result.couponCode}\n\n請妥善保存券碼，至合作店家使用。`,
    );
    return;
  }

  if (parsed.kind === 'jar_code') {
    if (!customer) {
      await replyLineText(replyToken, lineBindRequiredText());
      return;
    }

    const result = await redeemJarCode(customer.id, parsed.code);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    const stats = await getJarExchangeStatsForCustomer(customer.id);
    await replyLineText(
      replyToken,
      formatJarDepositSuccessMessage({
        customerName: customer.name,
        customerCode: customer.customerId,
        pointsBalance: result.balanceAfter,
        jarsDeposited: stats.codesRedeemed,
        pointsEarnedThisTime: result.pointsEarned,
        code: result.code,
      }),
    );
    return;
  }

  await replyLineText(replyToken, lineUnknownText());
}
