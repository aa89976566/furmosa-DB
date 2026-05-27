import { getLineChannelAccessToken } from '@/lib/line/config';

type LineTextMessage = { type: 'text'; text: string };

export async function replyLineMessage(replyToken: string, messages: LineTextMessage[]) {
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
