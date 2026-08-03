/** 與 LineReplyMessage 相容的最小形狀（避免與 reply.ts 循環依賴） */
type ExpandableMessage =
  | {
      type: 'text';
      text: string;
      quickReply?: { items: unknown[] };
      [key: string]: unknown;
    }
  | {
      type: 'flex' | 'image';
      [key: string]: unknown;
    };

/**
 * 文字訊息依換行拆成多則氣泡（空行略過）。
 * 有 quickReply 的文字不拆：按鈕必須跟同一則文案，避免「同意」被拆成多泡後才出現按鈕。
 * quickReply 掛在「該則原文」拆完後的最後一泡。
 */
export function expandLineMessages<T extends ExpandableMessage>(messages: T[]): T[] {
  const out: T[] = [];
  for (const msg of messages) {
    if (msg.type !== 'text') {
      out.push(msg);
      continue;
    }
    // 有按鈕的訊息整則保留，不拆行
    if (msg.quickReply) {
      out.push(msg);
      continue;
    }
    const parts = msg.text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const { quickReply, text: _text, ...rest } = msg;
      out.push({
        ...rest,
        type: 'text',
        text: parts[i]!,
        ...(isLast && quickReply ? { quickReply } : {}),
      } as T);
    }
  }
  return out;
}
