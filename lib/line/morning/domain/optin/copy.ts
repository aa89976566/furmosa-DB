/**
 * Brief-first CONSENSUS：偏好流程文案單一來源
 * LINE handler 與 HQ Preview 必須 import 此模組。
 */

import {
  listOnboardingModeOptions,
  OPTIN_CONTENT_OPTIONS,
  getContentOption,
  type OptinContentOption,
  type OptinFrequencyOption,
} from '@/lib/line/morning/domain/optin/options';
import {
  ONBOARDING_MODE_LABELS,
  getFirstContent,
  isOnboardingModeActionId,
  type OnboardingModeActionId,
} from '@/lib/line/morning/domain/optin/samples';
import {
  frequencyMorningText,
  renderScheduleLeadPhrase,
} from '@/lib/line/morning/domain/optin/schedule-phrase';

/** 顯示用（避免與 lib/line/morning/copy 循環依賴） */
const LEGACY_MODE_LABELS: Record<string, string> = {
  jokes: '笑個毛',
  news: '豎起耳朵',
  humor_only: '笑個毛',
  HUMOR_ONLY: '笑個毛',
  news_only: '豎起耳朵',
  NEWS_ONLY: '豎起耳朵',
  alternate: '笑話／新聞交替',
  ALTERNATE: '笑話／新聞交替',
  news_first_fact_fallback: '新鮮事；沒有時改冷知識',
  news_first_fact_or_humor_fallback: '新鮮事；沒有時冷知識／笑話',
  off: '先不用',
  OFF: '先不用',
  unset: '未設定',
  UNSET: '未設定',
};

const LEGACY_FREQ_LABELS: Record<string, string> = {
  daily: '每天早上',
  weekday: '平日早上',
  weekly: '每週五早上',
  off: '先不用',
  unset: '未設定',
};

export const OPTIN_EXPIRED_REPLY =
  '這組設定已過期，請重新開啟早安設定。';

export const OPTIN_CANCEL_REPLY =
  '好，這次先不改。之後想調再回「早安設定」。交易通知不受影響。';

export const OPTIN_ABORT_FREE_TEXT_REPLY =
  '這次設定先停下了。要繼續請回「早安設定」。';

export const OPTIN_SAMPLE_PASS_REPLY =
  '好，先不用。之後想開再回「早安設定」。交易通知不受影響。';

/** brief_pass 與 sample_pass 共用文案 */
export const OPTIN_BRIEF_PASS_REPLY = OPTIN_SAMPLE_PASS_REPLY;

/** 讀到 stale MODE_SAMPLE pending 時提示（清 pending → AWAITING_MODE） */
export const OPTIN_STALE_SAMPLE_REPLY =
  '設定內容已更新，請重新選一次';

export const OPTIN_LEGACY_KEEP_REPLY =
  '好，維持目前設定。之後想改再回「早安設定」。';

export const OPTIN_INVALID_STAY_HINT = '請用下方按鈕或回對應選項喔。';

export const OPTIN_FLOW_INTRO = [
  '【早安設定】',
  '只要設一次。之後想改或關掉，隨時回「早安設定」。',
  '確認後才會生效。',
].join('\n');

/** AWAITING_MODE：只兩項 */
export function renderModePrompt(): string {
  const labels = listOnboardingModeOptions()
    .map((o) => o.buttonLabel)
    .join('／');
  return [
    OPTIN_FLOW_INTRO,
    '',
    '想先試哪一種？',
    `回：${labels}`,
  ].join('\n');
}

/** @deprecated 相容舊名；sample-first 用 renderModePrompt */
export function renderContentPrompt(_opts?: {
  currentStorageMode?: string | null;
}): string {
  return renderModePrompt();
}

export function renderFrequencyPrompt(): string {
  return [
    '多久一次？',
    '回：每天早上／平日早上／每週五早上',
  ].join('\n');
}

export function contentLabel(option: OptinContentOption): string {
  if (option.actionId === 'content_a') return ONBOARDING_MODE_LABELS.content_a;
  if (option.actionId === 'content_b') return ONBOARDING_MODE_LABELS.content_b;
  if (option.actionId === 'content_legacy_alternate') {
    return '笑話／新聞交替（沿用）';
  }
  if (option.actionId === 'content_c') return '新鮮事，沒有就冷知識';
  if (option.actionId === 'content_d') return '新鮮事→冷知識→笑話';
  return '先不用';
}

export function frequencyLabel(option: OptinFrequencyOption): string {
  return option.buttonLabel;
}

/** Legacy 目前設定摘要（沿用 repo label；不寫入） */
export function renderLegacyPreferenceSummary(input: {
  contentMode: string;
  frequency: string;
}): string {
  const modeLabel =
    LEGACY_MODE_LABELS[input.contentMode] ?? input.contentMode;
  const freqLabel =
    LEGACY_FREQ_LABELS[input.frequency] ??
    frequencyMorningText(input.frequency);
  return [
    '【目前早安設定】',
    `內容：${modeLabel}`,
    `頻率：${freqLabel}`,
    '',
    '回「維持目前設定」結束；或「看看笑個毛／豎起耳朵」再選。',
  ].join('\n');
}

export function renderOptinSummary(input: {
  content: OptinContentOption;
  frequency: OptinFrequencyOption;
}): string {
  return [
    '請確認設定：',
    `內容：${contentLabel(input.content)}`,
    `頻率：${frequencyLabel(input.frequency)}`,
    '',
    input.content.actionId === 'content_b'
      ? '選豎起耳朵時：沒有合格新聞就略過，不會偷換成別的。'
      : null,
    input.content.actionId === 'content_e' ||
    input.frequency.actionId === 'freq_off'
      ? '確認後會關閉早安短訊；交易通知不受影響。'
      : '確認後才生效。之後可回「早安設定」修改或關閉。',
    '',
    '回「確認設定」或按確認；取消回「取消」。',
  ]
    .filter((x): x is string => x != null)
    .join('\n');
}

export function renderHumorCompletion(frequency: string): string {
  const lead = renderScheduleLeadPhrase(frequency);
  return [
    '收到。',
    `${lead}，我繞完一圈就來陪你笑個毛。`,
    '',
    '不講硬到要查答案的梗，也不只聊狗狗。',
    '想換口味或先休息，到活動中心找「早安設定」就好。',
  ].join('\n');
}

export function renderNewsCompletion(frequency: string): string {
  const lead = renderScheduleLeadPhrase(frequency);
  return [
    '收到。',
    `${lead}，我會替你豎起耳朵，聽聽毛孩圈有什麼新鮮事。`,
    '',
    '台灣消息優先，全球值得看的也不漏掉。',
    '沒有可靠內容就不硬湊，想調整時到活動中心找「早安設定」。',
  ].join('\n');
}

export function renderOptinSuccessSummary(input: {
  content: OptinContentOption;
  frequency: OptinFrequencyOption;
}): string {
  if (
    input.content.actionId === 'content_e' ||
    input.frequency.actionId === 'freq_off' ||
    input.content.storageMode === 'off' ||
    input.frequency.storageFrequency === 'off'
  ) {
    return '好，早安短訊先關掉。之後想開再回「早安設定」。交易通知不受影響。';
  }
  if (input.content.actionId === 'content_a') {
    return renderHumorCompletion(input.frequency.storageFrequency);
  }
  if (input.content.actionId === 'content_b') {
    return renderNewsCompletion(input.frequency.storageFrequency);
  }
  // legacy／FACT：保留簡短摘要（非本次 onboarding 主路徑）
  const cLabel = contentLabel(input.content);
  const fLabel = frequencyLabel(input.frequency);
  return `設定完成。內容：${cLabel}；頻率：${fLabel}。想改隨時回「早安設定」。`;
}

/**
 * CONFIRM winner 最終 reply 文案（同一 reply call；目標 ≤2 objects）
 * successSummary 寫入 ledger；messages 僅 winner composition 使用一次。
 */
export function buildOptinConfirmWinnerTexts(input: {
  content: OptinContentOption;
  frequency: OptinFrequencyOption;
}): { successSummary: string; messages: string[] } {
  const successSummary = renderOptinSuccessSummary(input);
  if (
    input.content.actionId === 'content_e' ||
    input.frequency.actionId === 'freq_off' ||
    input.content.storageMode === 'off' ||
    input.frequency.storageFrequency === 'off'
  ) {
    return { successSummary, messages: [successSummary] };
  }
  if (isOnboardingModeActionId(input.content.actionId)) {
    return {
      successSummary,
      messages: [successSummary, getFirstContent(input.content.actionId)],
    };
  }
  return { successSummary, messages: [successSummary] };
}

export function modeLabelForAction(actionId: OnboardingModeActionId): string {
  return ONBOARDING_MODE_LABELS[actionId];
}

/** 測試／HQ：完整 display labels 仍可列舉 */
export function listFullContentDisplayLabels(): Array<{
  actionId: string;
  domainMode: string;
  storageMode: string;
  label: string;
}> {
  return OPTIN_CONTENT_OPTIONS.map((o) => ({
    actionId: o.actionId,
    domainMode: o.domainMode,
    storageMode: o.storageMode,
    label: contentLabel(o),
  }));
}
