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
  renderSampleMessage,
  getSampleButtons,
  getContentOption,
  getFrequencyOption,
  isOnboardingModeActionId,
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
  samplePreview: string | null;
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
  notes: string[];
};

export function buildMorningOptinPreview(
  input: MorningOptinPreviewInput = {},
): MorningOptinPreviewResult {
  const notes: string[] = [
    '此 Preview 與 LINE「早安設定」共用 lib/line/morning/domain/optin。',
    'Onboarding 僅「笑個毛／豎起耳朵」；full mapping 仍保留 legacy／OFF。',
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

  let samplePreview: string | null = null;
  let sampleButtons: string[] = [];
  if (input.contentActionId && isOnboardingModeActionId(input.contentActionId)) {
    const mode = input.contentActionId as OnboardingModeActionId;
    samplePreview = renderSampleMessage(mode);
    sampleButtons = getSampleButtons(mode).map((b) => b.label);
  }

  let summary: string | null = null;
  let successSummary: string | null = null;
  if (input.contentActionId && input.frequencyActionId) {
    const content = getContentOption(input.contentActionId);
    const frequency = getFrequencyOption(input.frequencyActionId);
    if (content && frequency) {
      summary = renderOptinSummary({ content, frequency });
      successSummary = renderOptinSuccessSummary({ content, frequency });
    } else {
      notes.push('無效的 content／frequency action id');
    }
  }

  return {
    contentPrompt: renderModePrompt(),
    frequencyPrompt: renderFrequencyPrompt(),
    samplePreview,
    sampleButtons,
    contentOptions,
    allContentOptions,
    frequencyOptions,
    summary,
    successSummary,
    notes,
  };
}
