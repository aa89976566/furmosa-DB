/**
 * HQ Preview：與 LINE handler 共用同一 domain/optin 路徑
 * 不寫 preference、不呼叫 push／broadcast
 */

import {
  listOnboardingModeOptions,
  listActiveFrequencyOptions,
  listAllContentOptionsForDisplay,
  renderModePrompt,
  renderFrequencyPrompt,
  renderOptinSuccessSummary,
  renderOptinSummary,
  renderModeBriefMessage,
  getBriefButtons,
  getFirstContent,
  getContentOption,
  getFrequencyOption,
  isOnboardingModeActionId,
  buildOptinConfirmWinnerTexts,
  type OptinContentActionId,
  type OptinFrequencyActionId,
  type OnboardingModeActionId,
} from '@/lib/line/morning/domain/optin';

export type MorningOptinPreviewInput = {
  currentStorageMode?: string | null;
  contentActionId?: OptinContentActionId;
  frequencyActionId?: OptinFrequencyActionId;
};

export type MorningOptinPreviewResult = {
  contentPrompt: string;
  frequencyPrompt: string;
  /** MODE_BRIEF_SHOWN 一句 brief（CONFIRM 前；非完整 sample） */
  briefPreview: string | null;
  briefButtons: string[];
  /** CONFIRM winner 後 first content（與 LINE 同源） */
  firstContentPreview: string | null;
  /** @deprecated 相容舊欄位名；改指向 briefPreview */
  samplePreview: string | null;
  /** @deprecated 相容舊欄位名；改指向 briefButtons */
  sampleButtons: string[];
  contentOptions: Array<{
    actionId: string;
    buttonLabel: string;
    disclosure: string;
    storageMode: string;
    domainMode: string;
  }>;
  /** full mapping（含 legacy／OFF）收在 details 用 */
  allContentOptions: Array<{
    actionId: string;
    buttonLabel: string;
    storageMode: string;
    domainMode: string;
  }>;
  frequencyOptions: Array<{
    actionId: string;
    buttonLabel: string;
    disclosure: string;
    storageFrequency: string;
  }>;
  summary: string | null;
  successSummary: string | null;
  /** winner final reply texts（完成＋first content；≤2） */
  winnerReplyTexts: string[] | null;
  notes: string[];
};

export function buildMorningOptinPreview(
  input: MorningOptinPreviewInput = {},
): MorningOptinPreviewResult {
  const notes: string[] = [
    '此 Preview 與 LINE「早安設定」共用 lib/line/morning/domain/optin。',
    'Onboarding：mode → brief → frequency → summary → confirm（winner 才顯示 first content）。',
    '不寫入 preference；不呼叫 LINE push／broadcast。',
  ];
  const contentOptions = listOnboardingModeOptions().map((o) => ({
    actionId: o.actionId,
    buttonLabel: o.buttonLabel,
    disclosure: o.disclosure,
    storageMode: o.storageMode,
    domainMode: o.domainMode,
  }));
  const allContentOptions = listAllContentOptionsForDisplay().map((o) => ({
    actionId: o.actionId,
    buttonLabel: o.buttonLabel,
    storageMode: o.storageMode,
    domainMode: o.domainMode,
  }));
  const frequencyOptions = listActiveFrequencyOptions().map((o) => ({
    actionId: o.actionId,
    buttonLabel: o.buttonLabel,
    disclosure: o.disclosure,
    storageFrequency: o.storageFrequency,
  }));

  let briefPreview: string | null = null;
  let briefButtons: string[] = [];
  let firstContentPreview: string | null = null;
  if (input.contentActionId && isOnboardingModeActionId(input.contentActionId)) {
    const mode = input.contentActionId as OnboardingModeActionId;
    briefPreview = renderModeBriefMessage(mode);
    briefButtons = getBriefButtons().map((b) => b.label);
    firstContentPreview = getFirstContent(mode);
  }

  let summary: string | null = null;
  let successSummary: string | null = null;
  let winnerReplyTexts: string[] | null = null;
  if (input.contentActionId && input.frequencyActionId) {
    const content = getContentOption(input.contentActionId);
    const frequency = getFrequencyOption(input.frequencyActionId);
    if (content && frequency) {
      summary = renderOptinSummary({ content, frequency });
      successSummary = renderOptinSuccessSummary({ content, frequency });
      winnerReplyTexts = buildOptinConfirmWinnerTexts({
        content,
        frequency,
      }).messages;
    } else {
      notes.push('無效的 content／frequency action id');
    }
  }

  return {
    contentPrompt: renderModePrompt(),
    frequencyPrompt: renderFrequencyPrompt(),
    briefPreview,
    briefButtons,
    firstContentPreview,
    samplePreview: briefPreview,
    sampleButtons: briefButtons,
    contentOptions,
    allContentOptions,
    frequencyOptions,
    summary,
    successSummary,
    winnerReplyTexts,
    notes,
  };
}
