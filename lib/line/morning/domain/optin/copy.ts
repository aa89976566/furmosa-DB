/**
 * Phase 4B-B CONSENSUS：偏好流程文案單一來源
 * 成熟 Bark × 台灣語境；不用「小管家」；角色只在開頭／收尾點到。
 */

import {
  listContentOptionsForUser,
  OPTIN_FREQUENCY_OPTIONS,
  type OptinContentOption,
  type OptinFrequencyOption,
} from '@/lib/line/morning/domain/optin/options';

/** 錯 nonce／step／version／過期／歷史按鈕 — 固定句（不可回顯 nonce） */
export const OPTIN_EXPIRED_REPLY =
  '這組設定已過期，請重新開啟早安設定。';

export const OPTIN_CANCEL_REPLY =
  '好，這次先不改。之後想調再回「早安設定」。交易通知不受影響。';

export const OPTIN_ABORT_FREE_TEXT_REPLY =
  '這次設定先停下了。要繼續請回「早安設定」。';

export const OPTIN_FLOW_INTRO = [
  '【早安設定】',
  '我想確認你早上想不想收一則毛孩短訊。',
  '選完內容與頻率後會給你摘要，確認後才會生效。',
].join('\n');

export function renderContentPrompt(opts?: {
  currentStorageMode?: string | null;
}): string {
  const options = listContentOptionsForUser(opts?.currentStorageMode ?? null);
  const blocks = options.map((o) => o.disclosure);
  const legacyNote =
    opts?.currentStorageMode === 'alternate'
      ? '\n\n你目前為「沿用原設定：笑話／新聞交替」。重新確認後才會更換。'
      : '';
  return [
    OPTIN_FLOW_INTRO,
    '',
    '請選內容（點擊前請看清楚）：',
    '',
    blocks.join('\n\n'),
    legacyNote,
    '',
    '也可回 A～E 或按鈕上的短標。',
  ]
    .filter((line) => line !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export function renderFrequencyPrompt(): string {
  const blocks = OPTIN_FREQUENCY_OPTIONS.map(
    (o) => `${o.buttonLabel}\n→ ${o.disclosure}`,
  );
  return [
    '接下來選頻率：',
    '',
    blocks.join('\n\n'),
    '',
    '回：每天／平日／每週五／先不用',
  ].join('\n');
}

export function contentLabel(option: OptinContentOption): string {
  if (option.actionId === 'content_legacy_alternate') {
    return '沿用原設定：笑話／新聞交替';
  }
  if (option.actionId === 'content_a') return '毛孩笑話';
  if (option.actionId === 'content_b') return '只要寵物新鮮事';
  if (option.actionId === 'content_c') return '新鮮事；沒有時改冷知識';
  if (option.actionId === 'content_d') return '新鮮事；沒有時冷知識／笑話';
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
    '【設定摘要】請確認：',
    `內容：${contentLabel(input.content)}`,
    `頻率：${frequencyLabel(input.frequency)}`,
    '',
    input.content.actionId === 'content_b'
      ? '提醒：新鮮事來源尚未上線時，可能暫時收不到，不會改發其他內容。'
      : null,
    input.content.actionId === 'content_e' ||
    input.frequency.actionId === 'freq_off'
      ? '確認後早安短訊會關閉；交易通知不受影響。'
      : '確認後才會寫入。交易通知永遠不受早安設定影響。',
    '',
    '回「確認設定」或按確認；要取消回「取消」。',
  ]
    .filter((x): x is string => x != null)
    .join('\n');
}

/**
 * 成功摘要（byte-stable）：confirm ledger 重播必須一字不差。
 */
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
  return `設定完成。內容：${cLabel}；頻率：${fLabel}。早上見（若當天有交易通知，早安會讓路）。`;
}
