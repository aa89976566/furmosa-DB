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

async function postReply(replyToken: string, messages: LineReplyMessage[]) {
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
    throw new Error(`LINE Reply API 失敗 (${res.status}): ${body.slice(0, 300)}`);
  }
}

function stripImages(messages: LineReplyMessage[]): LineReplyMessage[] {
  return messages.filter((m) => m.type !== 'image');
}

/**
 * 回覆使用者。若含圖片被 LINE 拒收，自動降級為純文字／Flex，避免整段靜默。
 */
export async function replyLineMessage(replyToken: string, messages: LineReplyMessage[]) {
  const batch = messages.slice(0, 5);
  if (batch.length === 0) return;
  try {
    await postReply(replyToken, batch);
  } catch (err) {
    const hasImage = batch.some((m) => m.type === 'image');
    if (!hasImage) throw err;
    console.error('[line/reply] image reply failed, falling back to text', err);
    const fallback = stripImages(batch);
    if (fallback.length === 0) {
      await postReply(replyToken, [
        { type: 'text', text: '圖剛卡住了，內容在下面——再點一次也可以。' },
      ]);
      return;
    }
    await postReply(replyToken, fallback);
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

/** webhook 兜底：任何未接住的錯誤都盡力回一句，避免使用者無反應 */
export async function replyLineFallback(replyToken: string | undefined, text?: string) {
  if (!replyToken) return;
  try {
    await replyLineText(
      replyToken,
      text ?? '剛才打了個嗝，沒回成功。再點一次選單看看。',
    );
  } catch (err) {
    console.error('[line/reply] fallback also failed', err);
  }
}
