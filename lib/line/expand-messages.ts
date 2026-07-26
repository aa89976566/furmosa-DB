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
 * quickReply 掛在「該則原文」拆完後的最後一泡。
 */
export function expandLineMessages<T extends ExpandableMessage>(messages: T[]): T[] {
  const out: T[] = [];
  for (const msg of messages) {
    if (msg.type !== 'text') {
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
