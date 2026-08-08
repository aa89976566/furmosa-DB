/**
 * Phase 4B-A domain contract（canonical types）
 * DB 仍可存相容字串；決策／渲染走此層。
 */

/** 單一 Morning Program 的內容類型 */
export const MORNING_CONTENT_TYPES = ['NEWS', 'ANIMAL_FACT', 'HUMOR'] as const;
export type MorningContentType = (typeof MORNING_CONTENT_TYPES)[number];

/**
 * Domain contentMode（canonical）
 * - HUMOR_ONLY / NEWS_ONLY：與舊 jokes / news 語意完全相等
 * - ALTERNATE：舊 alternate；笑話↔新聞交替，不含 ANIMAL_FACT fallback
 * - NEWS_FIRST_*：僅供未來明確 re-opt-in；不得由舊值推定
 * - OFF / UNSET：不活躍；不得推定同意
 */
export const MORNING_DOMAIN_CONTENT_MODES = [
  'HUMOR_ONLY',
  'NEWS_ONLY',
  'ALTERNATE',
  'NEWS_FIRST_FACT_FALLBACK',
  'NEWS_FIRST_FACT_OR_HUMOR_FALLBACK',
  'OFF',
  'UNSET',
] as const;
export type MorningDomainContentMode =
  (typeof MORNING_DOMAIN_CONTENT_MODES)[number];

/** 活躍（可進入決策）的 modes */
export const MORNING_ACTIVE_DOMAIN_CONTENT_MODES = [
  'HUMOR_ONLY',
  'NEWS_ONLY',
  'ALTERNATE',
  'NEWS_FIRST_FACT_FALLBACK',
  'NEWS_FIRST_FACT_OR_HUMOR_FALLBACK',
] as const;
export type MorningActiveDomainContentMode =
  (typeof MORNING_ACTIVE_DOMAIN_CONTENT_MODES)[number];

/**
 * Domain frequency（canonical）
 * DB 仍為 daily|weekday|weekly|off|unset；weekday → WEEKDAYS
 */
export const MORNING_DOMAIN_FREQUENCIES = [
  'DAILY',
  'WEEKDAYS',
  'WEEKLY',
  'OFF',
  'UNSET',
] as const;
export type MorningDomainFrequency =
  (typeof MORNING_DOMAIN_FREQUENCIES)[number];

export const MORNING_ACTIVE_DOMAIN_FREQUENCIES = [
  'DAILY',
  'WEEKDAYS',
  'WEEKLY',
] as const;
export type MorningActiveDomainFrequency =
  (typeof MORNING_ACTIVE_DOMAIN_FREQUENCIES)[number];

/** Domain skip outcomes（對應既有 skipReason 字串） */
export const MORNING_DOMAIN_SKIP = {
  SKIPPED_NO_SAFE_NEWS: 'no_safe_news',
  SKIPPED_NO_CONTENT: 'no_content',
  NOT_OPTED_IN: 'not_opted_in',
  FREQUENCY_MISMATCH: 'frequency_mismatch',
} as const;

/** ANIMAL_FACT 必須出現的免責／揭露句（一字不差） */
export const ANIMAL_FACT_DISCLOSURE =
  '今天不是新聞，是壽司匠翻到的一則動物冷知識。';

/** 禁止把冷知識偽裝成新聞的用語 */
export const ANIMAL_FACT_BANNED_NEWS_IMPERSONATION = [
  '今日新聞',
  '最新新聞',
  '新聞快報',
  '據外媒報導',
  '本報訊',
  '剛剛發生',
  '突發',
] as const;
