/**
 * HQ Preview：與 LINE handler 共用同一 domain/optin 路徑
 * 不寫 preference、不呼叫 push／broadcast
 */

import {
  listContentOptionsForUser,
  OPTIN_FREQUENCY_OPTIONS,
  renderContentPrompt,
  renderFrequencyPrompt,
  renderOptinSuccessSummary,
  renderOptinSummary,
  getContentOption,
  getFrequencyOption,
  type OptinContentActionId,
  type OptinFrequencyActionId,
} from '@/lib/line/morning/domain/optin';

export type MorningOptinPreviewInput = {
  /** 目前 DB contentMode；alternate 時顯示沿用選項 */
  currentStorageMode?: string | null;
  contentActionId?: OptinContentActionId;
  frequencyActionId?: OptinFrequencyActionId;
};

export type MorningOptinPreviewResult = {
  contentPrompt: string;
  frequencyPrompt: string;
  contentOptions: Array<{
    actionId: string;
    buttonLabel: string;
    disclosure: string;
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
    '不寫入 preference；不呼叫 LINE push／broadcast。',
  ];
  const contentOptions = listContentOptionsForUser(
    input.currentStorageMode ?? null,
  ).map((o) => ({
    actionId: o.actionId,
    buttonLabel: o.buttonLabel,
    disclosure: o.disclosure,
    storageMode: o.storageMode,
    domainMode: o.domainMode,
  }));
  const frequencyOptions = OPTIN_FREQUENCY_OPTIONS.map((o) => ({
    actionId: o.actionId,
    buttonLabel: o.buttonLabel,
    disclosure: o.disclosure,
    storageFrequency: o.storageFrequency,
  }));

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
    contentPrompt: renderContentPrompt({
      currentStorageMode: input.currentStorageMode,
    }),
    frequencyPrompt: renderFrequencyPrompt(),
    contentOptions,
    frequencyOptions,
    summary,
    successSummary,
    notes,
  };
}
