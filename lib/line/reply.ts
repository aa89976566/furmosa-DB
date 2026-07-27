import { expandLineMessages } from '@/lib/line/expand-messages';
import { getLineChannelAccessToken } from '@/lib/line/config';
import { runAfterReply } from '@/lib/line/defer';
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
  /** 溢位 Push 改背景執行，讓 Reply 更快回到使用者（預設 true） */
  deferOverflow?: boolean;
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
 * 超過 5 則時：優先把 Flex 按鈕留在 Reply，其餘文字／圖進 overflow Push。
 */
export function prepareReplyMessages(
  messages: LineReplyMessage[],
  opts?: ReplyLineOptions,
): { reply: LineReplyMessage[]; overflow: LineReplyMessage[] } {
  const expanded = expandLineMessages(messages);
  if (expanded.length <= 5) {
    return { reply: expanded, overflow: [] };
  }
  if (!opts?.lineUserId && messages.length <= 5) {
    return { reply: messages, overflow: [] };
  }

  const images = expanded.filter((m) => m.type === 'image');
  const flexes = expanded.filter((m) => m.type === 'flex');
  const texts = expanded.filter((m) => m.type === 'text');

  const reply: LineReplyMessage[] = [];
  // 封面圖可進 Reply；但一定要留給 Flex 至少 1 格，避免按鈕被擠到 Push
  const reserveFlex = Math.min(flexes.length, 1);
  for (const img of images) {
    if (reply.length >= 5 - reserveFlex) break;
    reply.push(img);
  }
  const textBudget = Math.max(0, 5 - reply.length - flexes.length);
  reply.push(...texts.slice(0, textBudget));
  for (const flex of flexes) {
    if (reply.length >= 5) break;
    reply.push(flex);
  }

  const replySet = new Set(reply);
  const overflow = expanded.filter((m) => !replySet.has(m));
  if (!opts?.lineUserId) {
    return { reply: reply.slice(0, 5), overflow: [] };
  }
  return { reply, overflow };
}

/**
 * 回覆使用者。文字含換行會拆成多則氣泡。
 * 溢位訊息預設背景 Push，縮短使用者等到第一則回覆的時間。
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
    const pushTask = pushOverflow(opts.lineUserId, overflow);
    if (opts.deferOverflow === false) {
      await pushTask;
    } else {
      runAfterReply(pushTask);
    }
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
      text ?? '剛剛好像沒回成功，不好意思。再點一次選單試試看喔。',
    );
  } catch (err) {
    console.error('[line/reply] fallback also failed', err);
  }
}
