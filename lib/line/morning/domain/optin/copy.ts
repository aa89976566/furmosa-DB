/**
 * Phase 4B-B／4B-C：偏好流程文案單一來源（會員面向最小化）
 * 成熟 Bark × 台灣語境；不幼稚；隱藏技術 enum／英文 fallback。
 * LINE handler 與 HQ Preview 必須 import 此模組。
 */

import {
  listContentOptionsForUser,
  OPTIN_FREQUENCY_OPTIONS,
  type OptinContentOption,
  type OptinFrequencyOption,
} from '@/lib/line/morning/domain/optin/options';

export const OPTIN_EXPIRED_REPLY =
  '這組設定已過期，請重新開啟早安設定。';

export const OPTIN_CANCEL_REPLY =
  '好，這次先不改。之後想調再回「早安設定」。交易通知不受影響。';

export const OPTIN_ABORT_FREE_TEXT_REPLY =
  '這次設定先停下了。要繼續請回「早安設定」。';

/** 兩步設定：①想收什麼 ②多久一次 */
export const OPTIN_FLOW_INTRO = [
  '【早安設定】',
  '只要設一次。之後想改或關掉，隨時回「早安設定」。',
  '確認後才會生效。',
].join('\n');

export function renderContentPrompt(opts?: {
  currentStorageMode?: string | null;
}): string {
  const options = listContentOptionsForUser(opts?.currentStorageMode ?? null);
  const blocks = options.map((o) => o.disclosure);
  const legacyNote =
    opts?.currentStorageMode === 'alternate'
      ? '\n\n你目前是「笑話／新聞交替」。重新確認後才會換。'
      : '';
  return [
    OPTIN_FLOW_INTRO,
    '',
    '① 想收什麼？',
    '',
    blocks.join('\n\n'),
    legacyNote,
    '',
    '提醒：新聞來源可能暫時沒有；若選「只要新鮮事」，當天沒有就略過，不會改成別種內容。',
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export function renderFrequencyPrompt(): string {
  const labels = OPTIN_FREQUENCY_OPTIONS.map((o) => o.buttonLabel).join('／');
  return [
    '② 多久一次？',
    `回：${labels}`,
    '（每週五＝固定週五早上）',
  ].join('\n');
}

export function contentLabel(option: OptinContentOption): string {
  if (option.actionId === 'content_legacy_alternate') {
    return '笑話／新聞交替（沿用）';
  }
  if (option.actionId === 'content_a') return '毛孩笑話';
  if (option.actionId === 'content_b') return '只要新鮮事';
  if (option.actionId === 'content_c') return '新鮮事，沒有就冷知識';
  if (option.actionId === 'content_d') return '新鮮事→冷知識→笑話';
  return '先不用';
}

export function frequencyLabel(option: OptinFrequencyOption): string {
  return option.buttonLabel;
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
      ? '選只要新鮮事時：沒有合格新聞就略過，不會偷換成別的。'
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

export function renderOptinSuccessSummary(input: {
  content: OptinContentOption;
  frequency: OptinFrequencyOption;
}): string {
  const cLabel = contentLabel(input.content);
  const fLabel = frequencyLabel(input.frequency);
  if (
    input.content.actionId === 'content_e' ||
    input.frequency.actionId === 'freq_off' ||
    input.content.storageMode === 'off' ||
    input.frequency.storageFrequency === 'off'
  ) {
    return '好，早安短訊先關掉。之後想開再回「早安設定」。交易通知不受影響。';
  }
  return `設定完成。內容：${cLabel}；頻率：${fLabel}。想改隨時回「早安設定」。`;
}
