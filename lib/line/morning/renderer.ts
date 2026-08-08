/**
 * 正式 renderer：笑話／新聞 → LINE 文字（admin preview 必須走這裡）
 */

import { escapeForSafeDisplay } from '@/lib/line/morning/name';

const MAX_CHARS = 80;

export type RenderJokeInput = {
  body: string;
  customerName?: string | null;
};

export type RenderNewsInput = {
  factSummary: string;
  barkLine?: string | null;
  sourceName: string;
  canonicalUrl: string;
};

export type RenderResult = {
  text: string;
  charCount: number;
  truncated: boolean;
};

function trimToBudget(text: string, budget = MAX_CHARS): RenderResult {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= budget) {
    return { text: cleaned, charCount: cleaned.length, truncated: false };
  }
  // 盡量在標點切開
  const slice = cleaned.slice(0, budget - 1);
  const cut = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('，'), slice.lastIndexOf(' '));
  const body = (cut > 20 ? slice.slice(0, cut) : slice).trimEnd() + '…';
  return { text: body, charCount: body.length, truncated: true };
}

/** 笑話：日常情境→反應→小反轉；不混促銷 */
export function renderJokeMessage(input: RenderJokeInput): RenderResult {
  const body = input.body.trim();
  // 不把名字硬塞進每則（避免「主人」感）；僅確保無 HTML
  void escapeForSafeDisplay(input.customerName ?? '');
  return trimToBudget(body, MAX_CHARS);
}

/**
 * 新聞：事實 + 壽司匠一句觀察 + 來源連結
 * 來源行不計入 80 字主文預算（另起一行，確保可追溯）
 */
export function renderNewsMessage(input: RenderNewsInput): RenderResult {
  const fact = input.factSummary.trim();
  const bark = input.barkLine?.trim();
  const main = bark ? `${fact} ${bark}` : fact;
  const trimmed = trimToBudget(main, MAX_CHARS);
  const sourceLine = `來源：${input.sourceName}\n${input.canonicalUrl}`;
  return {
    text: `${trimmed.text}\n\n${sourceLine}`,
    charCount: trimmed.charCount,
    truncated: trimmed.truncated,
  };
}

export function assertNoPromo(text: string): boolean {
  return !/(折扣|優惠碼|限時|立刻購買|https?:\/\/.*(shop|cart))/i.test(text);
}
