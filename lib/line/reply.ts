import { getLineChannelAccessToken } from '@/lib/line/config';

export type LineQuickReplyItem = {
  type: 'action';
  action:
    | { type: 'message'; label: string; text: string }
    | { type: 'uri'; label: string; uri: string }
    | { type: 'postback'; label: string; data: string; displayText?: string };
};

export type LineReplyMessage = (
  | { type: 'text'; text: string }
  | { type: 'flex'; altText: string; contents: Record<string, unknown> }
  | {
      type: 'image';
      originalContentUrl: string;
      previewImageUrl: string;
    }
) & {
  quickReply?: { items: LineQuickReplyItem[] };
};

export async function replyLineMessage(replyToken: string, messages: LineReplyMessage[]) {
  const token = getLineChannelAccessToken();
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages: messages.slice(0, 5) }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LINE Reply API 失敗 (${res.status}): ${body.slice(0, 200)}`);
  }
}

export async function replyLineText(replyToken: string, text: string) {
  await replyLineMessage(replyToken, [{ type: 'text', text }]);
}

/** 同一 replyToken 僅能回覆一次，文字 + 其他訊息請合併 */
export async function replyLineTextPlus(
  replyToken: string,
  text: string,
  more: LineReplyMessage[],
) {
  await replyLineMessage(replyToken, [{ type: 'text', text }, ...more]);
}
