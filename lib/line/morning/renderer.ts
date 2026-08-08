/**
 * 正式 renderer：HUMOR／NEWS／ANIMAL_FACT → LINE 文字（admin preview 必須走這裡）
 */

import {
  ANIMAL_FACT_BANNED_NEWS_IMPERSONATION,
  ANIMAL_FACT_DISCLOSURE,
} from '@/lib/line/morning/domain/types';
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

export type RenderAnimalFactInput = {
  factSummary: string;
  barkLine?: string | null;
  attribution: string;
  canonicalUrl: string;
  sourcePublishedAt?: Date | null;
};

export type RenderResult = {
  text: string;
  charCount: number;
  truncated: boolean;
  issues?: string[];
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

/**
 * 動物冷知識：必須含固定揭露句；禁止新聞口吻；附來源（非新聞時效宣稱）
 */
export function renderAnimalFactMessage(
  input: RenderAnimalFactInput,
): RenderResult {
  const fact = input.factSummary.trim().replace(/\s+/g, ' ');
  const obs = input.barkLine?.trim().replace(/\s+/g, ' ');
  const issues: string[] = [];

  for (const ban of ANIMAL_FACT_BANNED_NEWS_IMPERSONATION) {
    if (fact.includes(ban) || (obs?.includes(ban) ?? false)) {
      issues.push(`fact_news_impersonation:${ban}`);
    }
  }

  const datePart = input.sourcePublishedAt
    ? `${input.sourcePublishedAt.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })} · `
    : '';
  const body = obs ? `${fact}\n${obs}` : fact;
  const text = [
    ANIMAL_FACT_DISCLOSURE,
    '',
    body,
    '',
    `來源：${datePart}${input.attribution}`,
    input.canonicalUrl,
  ].join('\n');

  if (!text.includes(ANIMAL_FACT_DISCLOSURE)) {
    issues.push('missing_animal_fact_disclosure');
  }

  const lint = lintMorningStyle(text, { kind: 'animal_fact', maxParagraphs: 4 });
  issues.push(...lint.issues);

  return {
    text,
    charCount: lint.charCount,
    truncated: false,
    issues: issues.length ? issues : undefined,
  };
}

export function assertNoPromo(text: string): boolean {
  return !/(折扣|優惠碼|限時|立刻購買|https?:\/\/.*(shop|cart))/i.test(text);
}

export function assertAnimalFactDisclosure(text: string): boolean {
  return text.includes(ANIMAL_FACT_DISCLOSURE);
}
