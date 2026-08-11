/**
 * Sample-first CONSENSUS：偏好選項單一來源
 * - onboarding 入口僅 HUMOR_ONLY「笑個毛」與 NEWS_ONLY「豎起耳朵」
 * - full display mapping 仍保留全部 legacy／OFF／FACT mixed（禁止刪 enum、禁止讀取 coerce）
 * LINE handler 與 HQ Preview 必須由此 import。
 */

import { ANIMAL_FACT_DISCLOSURE } from '@/lib/line/morning/domain/types';
import type { MorningDomainContentMode } from '@/lib/line/morning/domain/types';
import type { MorningContentMode, MorningFrequency } from '@/lib/line/morning/constants';
import {
  ONBOARDING_MODE_ACTION_IDS,
  ONBOARDING_MODE_LABELS,
  type OnboardingModeActionId,
} from '@/lib/line/morning/domain/optin/samples';

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

/** sample-first／legacy gate 專用 actions（不對應新 contentMode） */
export const OPTIN_FLOW_ACTION_IDS = [
  'sample_confirm',
  'sample_switch',
  'sample_pass',
  'legacy_keep',
  'legacy_explore',
] as const;
export type OptinFlowActionId = (typeof OPTIN_FLOW_ACTION_IDS)[number];

export type OptinActionId =
  | OptinContentActionId
  | OptinFrequencyActionId
  | OptinSummaryActionId
  | OptinFlowActionId;

export type OptinContentOption = {
  actionId: OptinContentActionId;
  buttonLabel: string;
  disclosure: string;
  domainMode: MorningDomainContentMode;
  storageMode: MorningContentMode;
  /** 舊 A–E 預設清單；sample-first onboarding 改用 listOnboardingModeOptions */
  showByDefault: boolean;
};

export type OptinFrequencyOption = {
  actionId: OptinFrequencyActionId;
  buttonLabel: string;
  disclosure: string;
  storageFrequency: MorningFrequency;
};

/** B：NEWS_ONLY 固定揭露（工程／測試用；會員 sample 另見 samples.ts） */
export const NEWS_ONLY_SOURCE_DISCLOSURE =
  '目前合法來源尚未上線；開啟後可能暫時收不到，不會改發其他內容';

/**
 * Full display mapping（含 legacy／OFF／FACT）。
 * 禁止刪除；讀取路徑不得 coerce 舊值。
 */
export const OPTIN_CONTENT_OPTIONS: readonly OptinContentOption[] = [
  {
    actionId: 'content_a',
    buttonLabel: ONBOARDING_MODE_LABELS.content_a,
    disclosure: [
      ONBOARDING_MODE_LABELS.content_a,
      '→ 只收日常小趣味。',
      '→ 不看新聞、不看冷知識。',
    ].join('\n'),
    domainMode: 'HUMOR_ONLY',
    storageMode: 'jokes',
    showByDefault: true,
  },
  {
    actionId: 'content_b',
    buttonLabel: ONBOARDING_MODE_LABELS.content_b,
    disclosure: [
      ONBOARDING_MODE_LABELS.content_b,
      '→ 只收通過安全檢查的新鮮事。',
      `→ ${NEWS_ONLY_SOURCE_DISCLOSURE}`,
    ].join('\n'),
    domainMode: 'NEWS_ONLY',
    storageMode: 'news',
    showByDefault: true,
  },
  {
    actionId: 'content_c',
    buttonLabel: '新鮮事／冷知識',
    disclosure: [
      '新鮮事；沒有時改冷知識',
      '→ 優先新鮮事；沒有才送冷知識。',
      `→ 冷知識會註明：「${ANIMAL_FACT_DISCLOSURE}」`,
    ].join('\n'),
    domainMode: 'NEWS_FIRST_FACT_FALLBACK',
    storageMode: 'news_first_fact_fallback',
    showByDefault: false,
  },
  {
    actionId: 'content_d',
    buttonLabel: '新鮮事／冷知識／笑話',
    disclosure: [
      '新鮮事；沒有時依序冷知識／笑話',
      '→ 新鮮事 → 冷知識 → 笑話。',
      `→ 冷知識會註明：「${ANIMAL_FACT_DISCLOSURE}」`,
    ].join('\n'),
    domainMode: 'NEWS_FIRST_FACT_OR_HUMOR_FALLBACK',
    storageMode: 'news_first_fact_or_humor_fallback',
    showByDefault: false,
  },
  {
    actionId: 'content_e',
    buttonLabel: '先不用',
    disclosure: [
      '先不用',
      '→ 關掉早安短訊。',
      '→ 訂單／付款／出貨通知不受影響。',
    ].join('\n'),
    domainMode: 'OFF',
    storageMode: 'off',
    showByDefault: false,
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

/** 頻率：active 三選一（先不用在 sample 步驟處理） */
export const OPTIN_FREQUENCY_OPTIONS: readonly OptinFrequencyOption[] = [
  {
    actionId: 'freq_daily',
    buttonLabel: '每天早上',
    disclosure: '有符合條件的內容時，每天早上都可能收到。',
    storageFrequency: 'daily',
  },
  {
    actionId: 'freq_weekdays',
    buttonLabel: '平日早上',
    disclosure: '週一至週五早上。',
    storageFrequency: 'weekday',
  },
  {
    actionId: 'freq_friday',
    buttonLabel: '每週五早上',
    disclosure: '固定每週五早上。',
    storageFrequency: 'weekly',
  },
  {
    actionId: 'freq_off',
    buttonLabel: '先不用',
    disclosure: '關閉頻率；交易通知不受影響。',
    storageFrequency: 'off',
  },
] as const;

/** sample-first 頻率步驟只顯示三個 active */
export function listActiveFrequencyOptions(): OptinFrequencyOption[] {
  return OPTIN_FREQUENCY_OPTIONS.filter((o) => o.actionId !== 'freq_off');
}

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

export function isOptinFlowActionId(v: string): v is OptinFlowActionId {
  return (OPTIN_FLOW_ACTION_IDS as readonly string[]).includes(v);
}

export function isAllowlistedOptinActionId(v: string): v is OptinActionId {
  return (
    isOptinContentActionId(v) ||
    isOptinFrequencyActionId(v) ||
    isOptinSummaryActionId(v) ||
    isOptinFlowActionId(v)
  );
}

/** Onboarding 入口：只兩項 */
export function listOnboardingModeOptions(): OptinContentOption[] {
  return ONBOARDING_MODE_ACTION_IDS.map((id) => getContentOption(id)!);
}

/**
 * @deprecated sample-first 請用 listOnboardingModeOptions
 * 保留：legacy alternate 顯示／舊測試相容
 */
export function listContentOptionsForUser(
  currentStorageMode: string | null | undefined,
): OptinContentOption[] {
  const showLegacy = currentStorageMode === 'alternate';
  const onboarding = listOnboardingModeOptions();
  if (showLegacy) {
    const legacy = getContentOption('content_legacy_alternate');
    return legacy ? [...onboarding, legacy] : onboarding;
  }
  return onboarding;
}

/** 完整 mapping（HQ／legacy 摘要用；含 OFF／FACT／alternate） */
export function listAllContentOptionsForDisplay(): OptinContentOption[] {
  return [...OPTIN_CONTENT_OPTIONS];
}

const CONTENT_TEXT_RULES: Array<{ re: RegExp; actionId: OptinContentActionId }> = [
  {
    re: /^(?:笑個毛|A|ａ|1|僅毛孩笑話|毛孩笑話|寵物笑話|笑話)$/i,
    actionId: 'content_a',
  },
  {
    re: /^(?:豎起耳朵|B|ｂ|2|只要寵物新鮮事|只要新鮮事|寵物新鮮事|新鮮事|新聞)$/i,
    actionId: 'content_b',
  },
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
  { re: /^(?:每天早上|每天|每日)$/, actionId: 'freq_daily' },
  { re: /^(?:平日早上|平日|工作日)$/, actionId: 'freq_weekdays' },
  { re: /^(?:每週五早上|每週五|每周五|每週|每周)$/, actionId: 'freq_friday' },
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

export function matchSampleActionFromText(
  raw: string,
  pendingMode: OnboardingModeActionId,
): OptinFlowActionId | null {
  const text = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (pendingMode === 'content_a') {
    if (/^(?:好，就笑個毛|好就笑個毛)$/.test(text)) return 'sample_confirm';
    if (/^(?:換成豎起耳朵)$/.test(text)) return 'sample_switch';
  } else {
    if (/^(?:好，我豎起耳朵|好我豎起耳朵)$/.test(text)) return 'sample_confirm';
    if (/^(?:換成笑個毛)$/.test(text)) return 'sample_switch';
  }
  if (/^(?:先不用)$/.test(text)) return 'sample_pass';
  return null;
}

export function matchLegacyGateActionFromText(
  raw: string,
): 'legacy_keep' | 'legacy_explore' | null {
  const text = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (/^(?:維持目前設定|維持)$/.test(text)) return 'legacy_keep';
  if (/^(?:看看笑個毛／豎起耳朵|看看笑個毛\/豎起耳朵|看看笑個毛|看看豎起耳朵)$/.test(text)) {
    return 'legacy_explore';
  }
  return null;
}

export { ONBOARDING_MODE_ACTION_IDS, ONBOARDING_MODE_LABELS };
export type { OnboardingModeActionId };
