import { redeemJarCode } from '@/lib/jar-exchange/redeem-code';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';
import { bindLineUserToCustomer, findCustomerByLineUserId } from '@/lib/line/bind-customer';
import {
  formatJarDepositSuccessMessage,
  formatQuickBalanceMessage,
  formatSavingsStatusMessage,
} from '@/lib/line/jar-deposit-copy';
import { buildMainMenuMessages, buildRedeemPickerMessages, replyJarDepositHub } from '@/lib/line/flex-menu';
import {
  LINE_BIND_HELP_TEXT,
  LINE_HELP_TEXT,
  LINE_WELCOME_TEXT,
  lineBindRequiredText,
  lineUnknownText,
} from '@/lib/line/messages';
import { handleLinePostback } from '@/lib/line/postback-actions';
import { parseLineUserText } from '@/lib/line/parse-message';
import { handleRegisterFlowMessage } from '@/lib/line/register-from-chat';
import {
  formatRewardMenuText,
  listActiveRewardsForLine,
  resolveRewardFromLineInput,
} from '@/lib/line/reward-menu';
import { replyLineMessage, replyLineText, replyLineTextPlus } from '@/lib/line/reply';
import { checkLineRateLimit } from '@/lib/line/rate-limit';

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
    await replyJarDepositHub(event.replyToken, {
      body: LINE_WELCOME_TEXT,
      registered: false,
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

  if (parsed.kind === 'help') {
    await replyJarDepositHub(replyToken, { body: LINE_HELP_TEXT, registered: Boolean(customer) });
    return;
  }

  if (parsed.kind === 'bind_help') {
    await replyJarDepositHub(replyToken, { body: LINE_BIND_HELP_TEXT, registered: false });
    return;
  }

  if (parsed.kind === 'greeting') {
    if (customer) {
      const snapshot = await loadDepositSnapshot(customer);
      await replyLineTextPlus(
        replyToken,
        `${LINE_WELCOME_TEXT}\n\n${formatQuickBalanceMessage(snapshot)}\n\n有空罐就傳序號存罐～`,
        buildMainMenuMessages({ registered: true }),
      );
      return;
    }
    await replyJarDepositHub(replyToken, { body: LINE_WELCOME_TEXT, registered: false });
    return;
  }

  if (parsed.kind === 'status' || parsed.kind === 'savings') {
    if (!customer) {
      await replyJarDepositHub(replyToken, { body: lineBindRequiredText(), registered: false });
      return;
    }
    await replyLineTextPlus(
      replyToken,
      formatSavingsStatusMessage(await loadDepositSnapshot(customer)),
      buildMainMenuMessages({ registered: true }),
    );
    return;
  }

  if (parsed.kind === 'bind') {
    const result = await bindLineUserToCustomer(lineUserId, parsed.identifier);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    await replyLineTextPlus(
      replyToken,
      `✅ 開戶成功！\n${result.customerName}\n\n傳 8 位序號存罐，或點下方按鈕。`,
      buildMainMenuMessages({ registered: true }),
    );
    return;
  }

  if (parsed.kind === 'balance') {
    if (!customer) {
      await replyJarDepositHub(replyToken, { body: lineBindRequiredText(), registered: false });
      return;
    }
    await replyLineTextPlus(
      replyToken,
      formatQuickBalanceMessage(await loadDepositSnapshot(customer)),
      buildMainMenuMessages({ registered: true }),
    );
    return;
  }

  if (parsed.kind === 'rewards_list') {
    const rewards = await listActiveRewardsForLine();
    if (!customer) {
      await replyJarDepositHub(replyToken, {
        body: `${formatRewardMenuText(rewards)}\n\n⚠️ 請先點「加入會員」。`,
        registered: false,
      });
      return;
    }
    const stats = await getJarExchangeStatsForCustomer(customer.id);
    await replyLineMessage(replyToken, buildRedeemPickerMessages(rewards, stats.pointsBalance));
    return;
  }

  if (parsed.kind === 'redeem_reward') {
    if (!customer) {
      await replyJarDepositHub(replyToken, { body: lineBindRequiredText(), registered: false });
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
    await replyLineTextPlus(
      replyToken,
      `🎁 兌換成功\n${reward.rewardName}\n消耗 ${result.pointsSpent} 點，餘額 ${result.balanceAfter} 點\n\n優惠券碼：${result.couponCode}`,
      buildMainMenuMessages({ registered: true }),
    );
    return;
  }

  if (parsed.kind === 'jar_code') {
    if (!customer) {
      await replyJarDepositHub(replyToken, { body: lineBindRequiredText(), registered: false });
      return;
    }

    const result = await redeemJarCode(customer.id, parsed.code);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    const stats = await getJarExchangeStatsForCustomer(customer.id);
    await replyLineTextPlus(
      replyToken,
      formatJarDepositSuccessMessage({
        customerName: customer.name,
        customerCode: customer.customerId,
        pointsBalance: result.balanceAfter,
        jarsDeposited: stats.codesRedeemed,
        pointsEarnedThisTime: result.pointsEarned,
        code: result.code,
      }),
      buildMainMenuMessages({ registered: true }),
    );
    return;
  }

  await replyJarDepositHub(replyToken, {
    body: lineUnknownText(),
    registered: Boolean(customer),
  });
}
