/**
 * 正式 renderer：笑話／新聞 → LINE 文字（admin preview 必須走這裡）
 */

import { escapeForSafeDisplay } from '@/lib/line/morning/name';
import { lintMorningStyle, renderNewsInStyle } from '@/lib/line/morning/style';

export type RenderJokeInput = {
  body: string;
  customerName?: string | null;
};

export type RenderNewsInput = {
  factSummary: string;
  barkLine?: string | null;
  sourceName: string;
  canonicalUrl: string;
  publishedAt?: Date | null;
};

export type RenderResult = {
  text: string;
  charCount: number;
  truncated: boolean;
};

/** 笑話：日常情境→反應→小反轉；不混促銷 */
export function renderJokeMessage(input: RenderJokeInput): RenderResult {
  const body = input.body.trim().replace(/\s+/g, ' ');
  void escapeForSafeDisplay(input.customerName ?? '');
  const lint = lintMorningStyle(body, { kind: 'joke', maxParagraphs: 3 });
  return {
    text: body,
    charCount: lint.charCount,
    truncated: false,
  };
}

/**
 * 新聞：事實 + 壽司匠一句觀察 + 來源連結（含日期若可顯示）
 */
export function renderNewsMessage(input: RenderNewsInput): RenderResult {
  const { text, lint } = renderNewsInStyle({
    factSummary: input.factSummary,
    observation: input.barkLine,
    sourceName: input.sourceName,
    publishedAt: input.publishedAt,
    canonicalUrl: input.canonicalUrl,
  });
  return {
    text,
    charCount: lint.charCount,
    truncated: lint.issues.includes('news_too_long'),
  };
}

export function assertNoPromo(text: string): boolean {
  return !/(折扣|優惠碼|限時|立刻購買|https?:\/\/.*(shop|cart))/i.test(text);
}
