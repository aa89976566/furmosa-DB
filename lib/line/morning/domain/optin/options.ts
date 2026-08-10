/**
 * Phase 4B-B／4B-C CONSENSUS：偏好選項單一來源（內容 A–E + 頻率）
 * LINE handler 與 HQ Preview 必須由此 import，禁止複製 switch／文案。
 * 會員文案隱藏技術 enum；工程測試仍可讀 domainMode／storageMode。
 */

import { ANIMAL_FACT_DISCLOSURE } from '@/lib/line/morning/domain/types';
import type { MorningDomainContentMode } from '@/lib/line/morning/domain/types';
import type { MorningContentMode, MorningFrequency } from '@/lib/line/morning/constants';

export const OPTIN_CONTENT_ACTION_IDS = [
  'content_a',
  'content_b',
  'content_c',
  'content_d',
  'content_e',
  'content_legacy_alternate',
] as const;
export type OptinContentActionId = (typeof OPTIN_CONTENT_ACTION_IDS)[number];

export const OPTIN_FREQUENCY_ACTION_IDS = [
  'freq_daily',
  'freq_weekdays',
  'freq_friday',
  'freq_off',
] as const;
export type OptinFrequencyActionId = (typeof OPTIN_FREQUENCY_ACTION_IDS)[number];

export const OPTIN_SUMMARY_ACTION_IDS = ['confirm', 'cancel'] as const;
export type OptinSummaryActionId = (typeof OPTIN_SUMMARY_ACTION_IDS)[number];

export type OptinActionId =
  | OptinContentActionId
  | OptinFrequencyActionId
  | OptinSummaryActionId;

export type OptinContentOption = {
  actionId: OptinContentActionId;
  buttonLabel: string;
  disclosure: string;
  domainMode: MorningDomainContentMode;
  storageMode: MorningContentMode;
  showByDefault: boolean;
};

export type OptinFrequencyOption = {
  actionId: OptinFrequencyActionId;
  buttonLabel: string;
  disclosure: string;
  storageFrequency: MorningFrequency;
};

/** B：NEWS_ONLY 固定揭露（一字契約；工程／測試用） */
export const NEWS_ONLY_SOURCE_DISCLOSURE =
  '目前合法來源尚未上線；開啟後可能暫時收不到，不會改發其他內容';

export const OPTIN_CONTENT_OPTIONS: readonly OptinContentOption[] = [
  {
    actionId: 'content_a',
    buttonLabel: 'A 毛孩笑話',
    disclosure: [
      'A 毛孩笑話',
      '→ 只收日常小趣味。',
      '→ 不看新聞、不看冷知識。',
    ].join('\n'),
    domainMode: 'HUMOR_ONLY',
    storageMode: 'jokes',
    showByDefault: true,
  },
  {
    actionId: 'content_b',
    buttonLabel: 'B 只要新鮮事',
    disclosure: [
      'B 只要寵物新鮮事',
      '→ 只收通過安全檢查的新鮮事。',
      `→ ${NEWS_ONLY_SOURCE_DISCLOSURE}`,
    ].join('\n'),
    domainMode: 'NEWS_ONLY',
    storageMode: 'news',
    showByDefault: true,
  },
  {
    actionId: 'content_c',
    buttonLabel: 'C 新鮮事／冷知識',
    disclosure: [
      'C 新鮮事；沒有時改冷知識',
      '→ 優先新鮮事；沒有才送冷知識。',
      `→ 冷知識會註明：「${ANIMAL_FACT_DISCLOSURE}」`,
    ].join('\n'),
    domainMode: 'NEWS_FIRST_FACT_FALLBACK',
    storageMode: 'news_first_fact_fallback',
    showByDefault: true,
  },
  {
    actionId: 'content_d',
    buttonLabel: 'D 新鮮事／冷知識／笑話',
    disclosure: [
      'D 新鮮事；沒有時依序冷知識／笑話',
      '→ 新鮮事 → 冷知識 → 笑話。',
      `→ 冷知識會註明：「${ANIMAL_FACT_DISCLOSURE}」`,
    ].join('\n'),
    domainMode: 'NEWS_FIRST_FACT_OR_HUMOR_FALLBACK',
    storageMode: 'news_first_fact_or_humor_fallback',
    showByDefault: true,
  },
  {
    actionId: 'content_e',
    buttonLabel: 'E 先不用',
    disclosure: [
      'E 先不用',
      '→ 關掉早安短訊。',
      '→ 訂單／付款／出貨通知不受影響。',
    ].join('\n'),
    domainMode: 'OFF',
    storageMode: 'off',
    showByDefault: true,
  },
  {
    actionId: 'content_legacy_alternate',
    buttonLabel: '沿用原交替',
    disclosure: [
      '沿用原設定：笑話／新聞交替',
      '→ 維持笑話與新聞輪替；不含冷知識。',
      '→ 只有你重新確認後才會換成其他模式。',
    ].join('\n'),
    domainMode: 'ALTERNATE',
    storageMode: 'alternate',
    showByDefault: false,
  },
] as const;

export const OPTIN_FREQUENCY_OPTIONS: readonly OptinFrequencyOption[] = [
  {
    actionId: 'freq_daily',
    buttonLabel: '每天',
    disclosure: '有符合條件的內容時，每天都可能收到。',
    storageFrequency: 'daily',
  },
  {
    actionId: 'freq_weekdays',
    buttonLabel: '平日',
    disclosure: '週一至週五。',
    storageFrequency: 'weekday',
  },
  {
    actionId: 'freq_friday',
    buttonLabel: '每週五',
    disclosure: '固定週五早上。',
    storageFrequency: 'weekly',
  },
  {
    actionId: 'freq_off',
    buttonLabel: '先不用',
    disclosure: '關閉頻率；交易通知不受影響。',
    storageFrequency: 'off',
  },
] as const;

const CONTENT_BY_ID = new Map(
  OPTIN_CONTENT_OPTIONS.map((o) => [o.actionId, o] as const),
);
const FREQ_BY_ID = new Map(
  OPTIN_FREQUENCY_OPTIONS.map((o) => [o.actionId, o] as const),
);

export function getContentOption(
  actionId: string,
): OptinContentOption | undefined {
  return CONTENT_BY_ID.get(actionId as OptinContentActionId);
}

export function getFrequencyOption(
  actionId: string,
): OptinFrequencyOption | undefined {
  return FREQ_BY_ID.get(actionId as OptinFrequencyActionId);
}

export function isOptinContentActionId(v: string): v is OptinContentActionId {
  return (OPTIN_CONTENT_ACTION_IDS as readonly string[]).includes(v);
}

export function isOptinFrequencyActionId(
  v: string,
): v is OptinFrequencyActionId {
  return (OPTIN_FREQUENCY_ACTION_IDS as readonly string[]).includes(v);
}

export function isOptinSummaryActionId(v: string): v is OptinSummaryActionId {
  return (OPTIN_SUMMARY_ACTION_IDS as readonly string[]).includes(v);
}

export function isAllowlistedOptinActionId(v: string): v is OptinActionId {
  return (
    isOptinContentActionId(v) ||
    isOptinFrequencyActionId(v) ||
    isOptinSummaryActionId(v)
  );
}

export function listContentOptionsForUser(
  currentStorageMode: string | null | undefined,
): OptinContentOption[] {
  const showLegacy = currentStorageMode === 'alternate';
  return OPTIN_CONTENT_OPTIONS.filter(
    (o) =>
      o.showByDefault ||
      (showLegacy && o.actionId === 'content_legacy_alternate'),
  );
}

const CONTENT_TEXT_RULES: Array<{ re: RegExp; actionId: OptinContentActionId }> = [
  { re: /^(?:A|ａ|1|僅毛孩笑話|毛孩笑話|寵物笑話|笑話)$/i, actionId: 'content_a' },
  { re: /^(?:B|ｂ|2|只要寵物新鮮事|只要新鮮事|寵物新鮮事|新鮮事|新聞)$/i, actionId: 'content_b' },
  {
    re: /^(?:C|ｃ|3|新鮮事，沒有時改成動物冷知識|新鮮事／冷知識|新鮮事\/冷知識)$/i,
    actionId: 'content_c',
  },
  {
    re: /^(?:D|ｄ|4|新鮮事，沒有時依序冷知識／笑話|新鮮事→冷知識→笑話|新鮮事\/冷知識\/笑話)$/i,
    actionId: 'content_d',
  },
  { re: /^(?:E|ｅ|5|先不用|內容先不用)$/i, actionId: 'content_e' },
  {
    re: /^(?:沿用原設定：笑話／新聞交替|沿用原設定|兩種交替|交替)$/,
    actionId: 'content_legacy_alternate',
  },
];

const FREQ_TEXT_RULES: Array<{ re: RegExp; actionId: OptinFrequencyActionId }> = [
  { re: /^(?:每天|每日)$/, actionId: 'freq_daily' },
  { re: /^(?:平日|工作日)$/, actionId: 'freq_weekdays' },
  { re: /^(?:每週五|每周五|每週|每周)$/, actionId: 'freq_friday' },
  { re: /^(?:先不用|頻率先不用|不用)$/, actionId: 'freq_off' },
];

export function matchContentActionFromText(raw: string): OptinContentActionId | null {
  const text = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  for (const rule of CONTENT_TEXT_RULES) {
    if (rule.re.test(text)) return rule.actionId;
  }
  return null;
}

export function matchFrequencyActionFromText(raw: string): OptinFrequencyActionId | null {
  const text = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  for (const rule of FREQ_TEXT_RULES) {
    if (rule.re.test(text)) return rule.actionId;
  }
  return null;
}

export function matchSummaryActionFromText(raw: string): OptinSummaryActionId | null {
  const text = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (/^(?:確認設定|確認|好|確定)$/.test(text)) return 'confirm';
  if (/^(?:取消|算了|不要了|back|返回)$/i.test(text)) return 'cancel';
  return null;
}
