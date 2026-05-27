import { redeemJarCode } from '@/lib/jar-exchange/redeem-code';
import { getPointsBalance } from '@/lib/jar-exchange/points';
import { prisma } from '@/lib/prisma';
import { bindLineUserToCustomer, findCustomerByLineUserId } from '@/lib/line/bind-customer';
import { LINE_HELP_TEXT, parseLineUserText } from '@/lib/line/parse-message';
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
      `歡迎加入匠寵換罐服務！\n\n您的 LINE ID：${lineUserId}\n（後台綁定時可使用此 ID）\n\n${LINE_HELP_TEXT}`,
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

  if (parsed.kind === 'help') {
    await replyLineText(replyToken, LINE_HELP_TEXT);
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
      `已綁定會員：${result.customerName}（${result.customerCode}）\n\n您的 LINE ID：${lineUserId}\n之後可直接傳 8 位返航序號兌換點數；傳「點數」可查餘額。`,
    );
    return;
  }

  const customer = await findCustomerByLineUserId(lineUserId);

  if (parsed.kind === 'balance') {
    if (!customer) {
      await replyLineText(
        replyToken,
        `尚未綁定會員。\n請傳：綁定 CUST-0001\n或：綁定 您的手機\n\n您的 LINE ID：${lineUserId}`,
      );
      return;
    }
    const balance = await getPointsBalance(prisma, customer.id);
    await replyLineText(
      replyToken,
      `${customer.name}（${customer.customerId}）\n目前換罐點數：${balance} 點`,
    );
    return;
  }

  if (parsed.kind === 'jar_code') {
    if (!customer) {
      await replyLineText(
        replyToken,
        `請先綁定會員再兌換序號。\n\n傳：綁定 CUST-0001\n或：綁定 您的手機\n\n您的 LINE ID：${lineUserId}`,
      );
      return;
    }

    const result = await redeemJarCode(customer.id, parsed.code);
    if (!result.ok) {
      await replyLineText(replyToken, result.error);
      return;
    }
    await replyLineText(
      replyToken,
      `兌換成功！\n序號 ${result.code}\n本次 +${result.pointsEarned} 點\n目前餘額 ${result.balanceAfter} 點\n\n${customer.name}（${customer.customerId}）`,
    );
    return;
  }

  await replyLineText(
    replyToken,
    `無法辨識的訊息。\n\n${LINE_HELP_TEXT}\n\n您的 LINE ID：${lineUserId}`,
  );
}
