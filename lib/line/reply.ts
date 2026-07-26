import { expandLineMessages } from '@/lib/line/expand-messages';
import { getLineChannelAccessToken } from '@/lib/line/config';
import { pushLineMessages } from '@/lib/line/push';

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

export type ReplyLineOptions = {
  /** 拆泡後超過 5 則時，其餘以 Push 接續（需 userId） */
  lineUserId?: string;
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

async function pushOverflow(lineUserId: string, messages: LineReplyMessage[]) {
  for (let i = 0; i < messages.length; i += 5) {
    const chunk = messages.slice(i, i + 5);
    const result = await pushLineMessages(lineUserId, chunk, { expand: false });
    if (!result.ok && !result.skipped) {
      console.error('[line/reply] overflow push failed', result.error);
    }
  }
}

/**
 * 準備送出的訊息：文字依換行拆泡。
 * 超過 5 則且有 lineUserId → 前回覆 5 則、其餘 push；
 * 無 userId 時若拆泡會爆量，則退回未拆結構以免截掉 Flex。
 */
export function prepareReplyMessages(
  messages: LineReplyMessage[],
  opts?: ReplyLineOptions,
): { reply: LineReplyMessage[]; overflow: LineReplyMessage[] } {
  const expanded = expandLineMessages(messages);
  if (expanded.length <= 5) {
    return { reply: expanded, overflow: [] };
  }
  if (opts?.lineUserId) {
    return { reply: expanded.slice(0, 5), overflow: expanded.slice(5) };
  }
  if (messages.length <= 5) {
    return { reply: messages, overflow: [] };
  }
  return { reply: expanded.slice(0, 5), overflow: [] };
}

/**
 * 回覆使用者。文字含換行會拆成多則氣泡。
 * 若含圖片被 LINE 拒收，自動降級為純文字／Flex，避免整段靜默。
 */
export async function replyLineMessage(
  replyToken: string,
  messages: LineReplyMessage[],
  opts?: ReplyLineOptions,
) {
  const { reply: batch, overflow } = prepareReplyMessages(messages, opts);
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
    } else {
      await postReply(replyToken, fallback);
    }
  }
  if (overflow.length > 0 && opts?.lineUserId) {
    await pushOverflow(opts.lineUserId, overflow);
  }
}

export async function replyLineText(
  replyToken: string,
  text: string,
  opts?: ReplyLineOptions,
) {
  await replyLineMessage(replyToken, [{ type: 'text', text }], opts);
}

/** 同一 replyToken 僅能回覆一次，文字 + 其他訊息請合併 */
export async function replyLineTextPlus(
  replyToken: string,
  text: string,
  more: LineReplyMessage[],
  opts?: ReplyLineOptions,
) {
  await replyLineMessage(replyToken, [{ type: 'text', text }, ...more], opts);
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
