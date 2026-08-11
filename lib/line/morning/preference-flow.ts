/**
 * Sample-first CONSENSUS：雙選項 sample flow
 * IDLE → mode → sample → frequency → summary → confirm
 * Legacy：摘要 → keep(0 writes)／explore → mode…
 * 僅 confirm 單交易寫入 preference；此前 preference 0 writes
 */

import {
  clearLineChatSession,
  getLineChatSession,
  upsertLineChatSession,
} from '@/lib/line/chat-session';
import { parseLineUserText } from '@/lib/line/parse-message';
import { SESSION_BYPASS_KINDS } from '@/lib/line/session-leave';
import {
  OPTIN_CANCEL_REPLY,
  OPTIN_EXPIRED_REPLY,
  OPTIN_INVALID_STAY_HINT,
  OPTIN_LEGACY_KEEP_REPLY,
  OPTIN_SAMPLE_PASS_REPLY,
  buildOptinPostbackData,
  createOptinNonce,
  digestOptinConfirmPayload,
  getContentOption,
  getFrequencyOption,
  getSampleButtons,
  isOnboardingModeActionId,
  isOptinContentActionId,
  isOptinFrequencyActionId,
  listActiveFrequencyOptions,
  listOnboardingModeOptions,
  matchContentActionFromText,
  matchFrequencyActionFromText,
  matchLegacyGateActionFromText,
  matchSampleActionFromText,
  matchSummaryActionFromText,
  newOptinDraft,
  normalizeOptinFlowStep,
  otherOnboardingMode,
  parseMorningOptinDraft,
  parseOptinPostbackData,
  renderFrequencyPrompt,
  renderLegacyPreferenceSummary,
  renderModePrompt,
  renderOptinSuccessSummary,
  renderOptinSummary,
  renderSampleMessage,
  resolveOptinEventKey,
  assertDraftMatchesPostback,
  isOptinFlowStep,
  OPTIN_FLOW,
  type MorningOptinDraft,
  type OnboardingModeActionId,
  type OptinActionId,
  type OptinContentActionId,
  type OptinFlowStep,
  type OptinFrequencyActionId,
} from '@/lib/line/morning/domain/optin';
import {
  MORNING_STOP_CLARIFY,
  morningPausedText,
  morningResumedText,
  morningUnsubscribedText,
} from '@/lib/line/morning/copy';
import { parseMorningCommand } from '@/lib/line/morning/commands';
import {
  createConfirmLedgerSuccess,
  findConfirmLedgerByEventKey,
  findConfirmLedgersByNonceHash,
  hashOptinSessionNonce,
  isIdenticalConfirmSuccess,
  type ConfirmLedgerRow,
  type CreateConfirmLedgerInput,
} from '@/lib/line/morning/confirm-ledger';
import {
  getMorningPreference,
  isPreferenceComplete,
  upsertMorningPreference,
  type MorningPreferenceRow,
} from '@/lib/line/morning/preferences';
import {
  replyLineMessage,
  type LineQuickReplyItem,
  type LineReplyMessage,
} from '@/lib/line/reply';
import { prisma } from '@/lib/prisma';

export type PreferenceFlowReplyFn = (
  replyToken: string,
  messages: LineReplyMessage[],
) => Promise<void>;

export type ConfirmTxClient = {
  upsertPreference: typeof upsertMorningPreference;
  createLedgerSuccess: (
    input: CreateConfirmLedgerInput,
  ) => Promise<ConfirmLedgerRow>;
  findLedgerByEventKey: typeof findConfirmLedgerByEventKey;
  findLedgersByNonceHash: typeof findConfirmLedgersByNonceHash;
  getSession: typeof getLineChatSession;
  clearSession: typeof clearLineChatSession;
};

export type PreferenceFlowDeps = {
  getSession: typeof getLineChatSession;
  upsertSession: typeof upsertLineChatSession;
  clearSession: typeof clearLineChatSession;
  getPreference: typeof getMorningPreference;
  upsertPreference: typeof upsertMorningPreference;
  findLedgerByEventKey: typeof findConfirmLedgerByEventKey;
  findLedgersByNonceHash: typeof findConfirmLedgersByNonceHash;
  createLedgerSuccess: (
    input: CreateConfirmLedgerInput,
  ) => Promise<ConfirmLedgerRow>;
  reply: PreferenceFlowReplyFn;
  now: () => Date;
  createNonce: () => string;
  /** 未建 profile → 走既有註冊閘門；null＝允許（測試） */
  findCustomerIdByLineUserId?: (lineUserId: string) => Promise<string | null>;
  /** 註冊閘門回覆（預設文字） */
  replyRegisterGate?: PreferenceFlowReplyFn;
  runConfirmTransaction: <T>(
    fn: (tx: ConfirmTxClient) => Promise<T>,
  ) => Promise<T>;
};

const REGISTER_GATE_TEXT =
  '麻煩先幫毛孩開個戶喔～\n開好戶再回「早安設定」，我再陪你選。';

const defaultDeps: PreferenceFlowDeps = {
  getSession: getLineChatSession,
  upsertSession: upsertLineChatSession,
  clearSession: clearLineChatSession,
  getPreference: getMorningPreference,
  upsertPreference: upsertMorningPreference,
  findLedgerByEventKey: findConfirmLedgerByEventKey,
  findLedgersByNonceHash: findConfirmLedgersByNonceHash,
  createLedgerSuccess: (input) => createConfirmLedgerSuccess(input),
  reply: async (replyToken, messages) => {
    await replyLineMessage(replyToken, messages);
  },
  now: () => new Date(),
  createNonce: createOptinNonce,
  findCustomerIdByLineUserId: async (lineUserId) => {
    const c = await prisma.customer.findFirst({
      where: { lineUserId },
      select: { id: true },
    });
    return c?.id ?? null;
  },
  replyRegisterGate: async (replyToken, messages) => {
    await replyLineMessage(replyToken, messages);
  },
  runConfirmTransaction: async (fn) =>
    prisma.$transaction(async (tx) =>
      fn({
        upsertPreference: (lineUserId, data) =>
          upsertMorningPreference(lineUserId, data, tx),
        createLedgerSuccess: (input) => createConfirmLedgerSuccess(input, tx),
        findLedgerByEventKey: (eventDedupKey) =>
          findConfirmLedgerByEventKey(eventDedupKey, tx),
        findLedgersByNonceHash: (sessionNonceHash) =>
          findConfirmLedgersByNonceHash(sessionNonceHash, tx),
        getSession: getLineChatSession,
        clearSession: clearLineChatSession,
      }),
    ),
};

function resolveDeps(overrides?: Partial<PreferenceFlowDeps>): PreferenceFlowDeps {
  return { ...defaultDeps, ...overrides };
}

function qrPostback(
  label: string,
  data: string,
  displayText?: string,
): LineQuickReplyItem {
  return {
    type: 'action',
    action: {
      type: 'postback',
      label: label.slice(0, 20),
      data,
      displayText: displayText ?? label.slice(0, 20),
    },
  };
}

function buildModeQuickReply(draft: MorningOptinDraft): LineQuickReplyItem[] {
  return listOnboardingModeOptions().map((opt) =>
    qrPostback(
      opt.buttonLabel,
      buildOptinPostbackData({
        nonce: draft.nonce,
        version: draft.version,
        step: 'mode',
        actionId: opt.actionId,
      }),
      opt.buttonLabel,
    ),
  );
}

function buildSampleQuickReply(
  draft: MorningOptinDraft,
  pending: OnboardingModeActionId,
): LineQuickReplyItem[] {
  return getSampleButtons(pending).map((btn) =>
    qrPostback(
      btn.label,
      buildOptinPostbackData({
        nonce: draft.nonce,
        version: draft.version,
        step: 'sample',
        actionId: btn.actionId,
      }),
      btn.label,
    ),
  );
}

function buildFrequencyQuickReply(draft: MorningOptinDraft): LineQuickReplyItem[] {
  return listActiveFrequencyOptions().map((opt) =>
    qrPostback(
      opt.buttonLabel,
      buildOptinPostbackData({
        nonce: draft.nonce,
        version: draft.version,
        step: 'frequency',
        actionId: opt.actionId,
      }),
    ),
  );
}

function buildSummaryQuickReply(draft: MorningOptinDraft): LineQuickReplyItem[] {
  return [
    qrPostback(
      '確認設定',
      buildOptinPostbackData({
        nonce: draft.nonce,
        version: draft.version,
        step: 'summary',
        actionId: 'confirm',
      }),
    ),
    qrPostback(
      '取消',
      buildOptinPostbackData({
        nonce: draft.nonce,
        version: draft.version,
        step: 'summary',
        actionId: 'cancel',
      }),
    ),
  ];
}

function buildLegacyQuickReply(draft: MorningOptinDraft): LineQuickReplyItem[] {
  return [
    qrPostback(
      '維持目前設定',
      buildOptinPostbackData({
        nonce: draft.nonce,
        version: draft.version,
        step: 'legacy',
        actionId: 'legacy_keep',
      }),
    ),
    qrPostback(
      '看看笑個毛／豎起耳朵',
      buildOptinPostbackData({
        nonce: draft.nonce,
        version: draft.version,
        step: 'legacy',
        actionId: 'legacy_explore',
      }),
      '看看笑個毛／豎起耳朵',
    ),
  ];
}

async function replyExpired(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
): Promise<void> {
  await deps.clearSession(lineUserId);
  await deps.reply(replyToken, [{ type: 'text', text: OPTIN_EXPIRED_REPLY }]);
}

async function redisplayCurrentStep(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
  step: OptinFlowStep,
  draft: MorningOptinDraft,
): Promise<void> {
  const hint = OPTIN_INVALID_STAY_HINT;
  if (step === 'legacy') {
    const pref = await deps.getPreference(lineUserId);
    const text = [
      renderLegacyPreferenceSummary({
        contentMode: pref?.contentMode ?? 'unset',
        frequency: pref?.frequency ?? 'unset',
      }),
      '',
      hint,
    ].join('\n');
    await deps.reply(replyToken, [
      { type: 'text', text, quickReply: { items: buildLegacyQuickReply(draft) } },
    ]);
    return;
  }
  if (step === 'mode' || step === 'content') {
    await deps.reply(replyToken, [
      {
        type: 'text',
        text: `${renderModePrompt()}\n\n${hint}`,
        quickReply: { items: buildModeQuickReply(draft) },
      },
    ]);
    return;
  }
  if (step === 'sample' && draft.contentActionId && isOnboardingModeActionId(draft.contentActionId)) {
    const pending = draft.contentActionId;
    await deps.reply(replyToken, [
      {
        type: 'text',
        text: `${renderSampleMessage(pending)}\n\n${hint}`,
        quickReply: { items: buildSampleQuickReply(draft, pending) },
      },
    ]);
    return;
  }
  if (step === 'frequency') {
    await deps.reply(replyToken, [
      {
        type: 'text',
        text: `${renderFrequencyPrompt()}\n\n${hint}`,
        quickReply: { items: buildFrequencyQuickReply(draft) },
      },
    ]);
    return;
  }
  if (step === 'summary' && draft.contentActionId && draft.frequencyActionId) {
    const content = getContentOption(draft.contentActionId)!;
    const frequency = getFrequencyOption(draft.frequencyActionId)!;
    await deps.reply(replyToken, [
      {
        type: 'text',
        text: `${renderOptinSummary({ content, frequency })}\n\n${hint}`,
        quickReply: { items: buildSummaryQuickReply(draft) },
      },
    ]);
    return;
  }
  await replyExpired(deps, replyToken, lineUserId);
}

async function enterModeStep(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
  draft: MorningOptinDraft,
): Promise<void> {
  await deps.upsertSession(lineUserId, OPTIN_FLOW, 'mode', draft);
  await deps.reply(replyToken, [
    {
      type: 'text',
      text: renderModePrompt(),
      quickReply: { items: buildModeQuickReply(draft) },
    },
  ]);
}

async function enterSampleStep(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
  draft: MorningOptinDraft,
  pendingMode: OnboardingModeActionId,
): Promise<void> {
  const next: MorningOptinDraft = {
    ...draft,
    version: draft.version + 1,
    contentActionId: pendingMode,
    frequencyActionId: undefined,
  };
  await deps.upsertSession(lineUserId, OPTIN_FLOW, 'sample', next);
  await deps.reply(replyToken, [
    {
      type: 'text',
      text: renderSampleMessage(pendingMode),
      quickReply: { items: buildSampleQuickReply(next, pendingMode) },
    },
  ]);
}

async function advanceToFrequency(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
  draft: MorningOptinDraft,
): Promise<void> {
  const next: MorningOptinDraft = {
    ...draft,
    version: draft.version + 1,
    frequencyActionId: undefined,
  };
  await deps.upsertSession(lineUserId, OPTIN_FLOW, 'frequency', next);
  await deps.reply(replyToken, [
    {
      type: 'text',
      text: renderFrequencyPrompt(),
      quickReply: { items: buildFrequencyQuickReply(next) },
    },
  ]);
}

async function advanceToSummary(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
  draft: MorningOptinDraft,
  frequencyActionId: OptinFrequencyActionId,
): Promise<void> {
  if (!draft.contentActionId) {
    await replyExpired(deps, replyToken, lineUserId);
    return;
  }
  const next: MorningOptinDraft = {
    ...draft,
    version: draft.version + 1,
    frequencyActionId,
  };
  await deps.upsertSession(lineUserId, OPTIN_FLOW, 'summary', next);
  const content = getContentOption(draft.contentActionId)!;
  const frequency = getFrequencyOption(frequencyActionId)!;
  await deps.reply(replyToken, [
    {
      type: 'text',
      text: renderOptinSummary({ content, frequency }),
      quickReply: { items: buildSummaryQuickReply(next) },
    },
  ]);
}

async function tryReplayIdenticalConfirm(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
  input: {
    eventDedupKey: string;
    sessionNonceHash: string;
    stepVersion: number;
    payloadDigest: string;
  },
): Promise<'replayed' | 'rejected' | 'miss'> {
  const row = await deps.findLedgerByEventKey(input.eventDedupKey);
  if (!row) return 'miss';
  if (isIdenticalConfirmSuccess({ row, ...input })) {
    await deps.reply(replyToken, [{ type: 'text', text: row.successSummary }]);
    return 'replayed';
  }
  await replyExpired(deps, replyToken, lineUserId);
  return 'rejected';
}

async function applyConfirm(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
  draft: MorningOptinDraft,
  eventKey: string,
): Promise<void> {
  if (!draft.contentActionId || !draft.frequencyActionId) {
    await replyExpired(deps, replyToken, lineUserId);
    return;
  }
  const content = getContentOption(draft.contentActionId);
  const frequency = getFrequencyOption(draft.frequencyActionId);
  if (!content || !frequency) {
    await replyExpired(deps, replyToken, lineUserId);
    return;
  }

  // 完成後相同設定 no-op：若 preference 已相同且有 ledger 成功摘要
  const existingPref = await deps.getPreference(lineUserId);
  if (
    existingPref &&
    existingPref.contentMode === content.storageMode &&
    existingPref.frequency === frequency.storageFrequency &&
    isPreferenceComplete(existingPref)
  ) {
    await deps.clearSession(lineUserId);
    await deps.reply(replyToken, [
      {
        type: 'text',
        text: [
          '目前已是這個設定，不用再改一次。',
          '',
          renderLegacyPreferenceSummary({
            contentMode: existingPref.contentMode,
            frequency: existingPref.frequency,
          }),
        ].join('\n'),
      },
    ]);
    return;
  }

  const successSummary = renderOptinSuccessSummary({ content, frequency });
  const payloadDigest = digestOptinConfirmPayload({
    contentActionId: content.actionId,
    frequencyActionId: frequency.actionId,
    storageMode: content.storageMode,
    storageFrequency: frequency.storageFrequency,
  });
  const sessionNonceHash = hashOptinSessionNonce(draft.nonce);
  const stepVersion = draft.version;
  const matchInput = {
    eventDedupKey: eventKey,
    sessionNonceHash,
    stepVersion,
    payloadDigest,
  };

  const existingByEvent = await deps.findLedgerByEventKey(eventKey);
  if (existingByEvent) {
    if (isIdenticalConfirmSuccess({ row: existingByEvent, ...matchInput })) {
      await deps.reply(replyToken, [
        { type: 'text', text: existingByEvent.successSummary },
      ]);
      return;
    }
    await replyExpired(deps, replyToken, lineUserId);
    return;
  }

  const byNonce = await deps.findLedgersByNonceHash(sessionNonceHash);
  if (byNonce.length > 0) {
    await replyExpired(deps, replyToken, lineUserId);
    return;
  }

  let wrote = false;
  try {
    await deps.runConfirmTransaction(async (tx) => {
      const again = await tx.findLedgerByEventKey(eventKey);
      if (again) return;
      const nonceHit = await tx.findLedgersByNonceHash(sessionNonceHash);
      if (nonceHit.length > 0) return;

      const session = await tx.getSession(lineUserId);
      if (!session || session.flow !== OPTIN_FLOW || session.step !== 'summary') {
        return;
      }
      const fresh = parseMorningOptinDraft(session.payload);
      if (
        !fresh ||
        fresh.nonce !== draft.nonce ||
        fresh.version !== draft.version
      ) {
        return;
      }

      await tx.upsertPreference(lineUserId, {
        contentMode: content.storageMode,
        frequency: frequency.storageFrequency,
        pausedAt: null,
        promptedAt: deps.now(),
      });
      await tx.createLedgerSuccess({
        lineUserId,
        eventDedupKey: eventKey,
        sessionNonceHash,
        stepVersion,
        payloadDigest,
        preferenceSnapshot: {
          contentMode: content.storageMode,
          frequency: frequency.storageFrequency,
        },
        successSummary,
        now: deps.now(),
      });
      await tx.clearSession(lineUserId);
      wrote = true;
    });
  } catch (err) {
    console.error('[line/morning] confirm ledger write conflict', err);
    const outcome = await tryReplayIdenticalConfirm(
      deps,
      replyToken,
      lineUserId,
      matchInput,
    );
    if (outcome === 'miss') {
      await replyExpired(deps, replyToken, lineUserId);
    }
    return;
  }

  if (!wrote) {
    const outcome = await tryReplayIdenticalConfirm(
      deps,
      replyToken,
      lineUserId,
      matchInput,
    );
    if (outcome === 'miss') {
      await replyExpired(deps, replyToken, lineUserId);
    }
    return;
  }

  await deps.reply(replyToken, [{ type: 'text', text: successSummary }]);
}

async function handleAction(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
  draft: MorningOptinDraft,
  sessionStep: OptinFlowStep,
  actionId: OptinActionId,
  eventKey: string,
): Promise<void> {
  const step = normalizeOptinFlowStep(sessionStep) ?? sessionStep;

  if (step === 'legacy') {
    if (actionId === 'legacy_keep') {
      await deps.clearSession(lineUserId);
      await deps.reply(replyToken, [
        { type: 'text', text: OPTIN_LEGACY_KEEP_REPLY },
      ]);
      return;
    }
    if (actionId === 'legacy_explore') {
      const next = newOptinDraft({ nonce: draft.nonce, now: deps.now() });
      // 保留同一 nonce 家族？改新 nonce 較安全重啟
      const fresh = newOptinDraft({
        nonce: deps.createNonce(),
        now: deps.now(),
      });
      void next;
      await enterModeStep(deps, replyToken, lineUserId, fresh);
      return;
    }
    await redisplayCurrentStep(deps, replyToken, lineUserId, 'legacy', draft);
    return;
  }

  if (step === 'mode') {
    if (!isOptinContentActionId(actionId) || !isOnboardingModeActionId(actionId)) {
      await redisplayCurrentStep(deps, replyToken, lineUserId, 'mode', draft);
      return;
    }
    await enterSampleStep(deps, replyToken, lineUserId, draft, actionId);
    return;
  }

  if (step === 'sample') {
    if (!draft.contentActionId || !isOnboardingModeActionId(draft.contentActionId)) {
      await replyExpired(deps, replyToken, lineUserId);
      return;
    }
    const pending = draft.contentActionId;
    if (actionId === 'sample_confirm') {
      await advanceToFrequency(deps, replyToken, lineUserId, draft);
      return;
    }
    if (actionId === 'sample_switch') {
      const other = otherOnboardingMode(pending);
      await enterSampleStep(deps, replyToken, lineUserId, draft, other);
      return;
    }
    if (actionId === 'sample_pass') {
      await deps.clearSession(lineUserId);
      await deps.reply(replyToken, [
        { type: 'text', text: OPTIN_SAMPLE_PASS_REPLY },
      ]);
      return;
    }
    await redisplayCurrentStep(deps, replyToken, lineUserId, 'sample', draft);
    return;
  }

  if (step === 'frequency') {
    if (!isOptinFrequencyActionId(actionId) || actionId === 'freq_off') {
      await redisplayCurrentStep(deps, replyToken, lineUserId, 'frequency', draft);
      return;
    }
    await advanceToSummary(deps, replyToken, lineUserId, draft, actionId);
    return;
  }

  if (step === 'summary') {
    if (actionId === 'cancel') {
      await deps.clearSession(lineUserId);
      await deps.reply(replyToken, [{ type: 'text', text: OPTIN_CANCEL_REPLY }]);
      return;
    }
    if (actionId === 'confirm') {
      await applyConfirm(deps, replyToken, lineUserId, draft, eventKey);
      return;
    }
    await redisplayCurrentStep(deps, replyToken, lineUserId, 'summary', draft);
    return;
  }

  await replyExpired(deps, replyToken, lineUserId);
}

/**
 * 開啟偏好流程（preference 0 writes；只寫 LineChatSession draft）
 * 安全重啟：清過期 pending，不沿用。
 */
export async function startMorningPreferenceFlow(
  replyToken: string | null,
  lineUserId: string,
  opts?: {
    fromSettings?: boolean;
    reply?: boolean;
    deps?: Partial<PreferenceFlowDeps>;
  },
): Promise<{ text: string; nonce: string; version: number; step: OptinFlowStep }> {
  const deps = resolveDeps(opts?.deps);

  // auth guard：未建 profile → 既有註冊流程
  if (deps.findCustomerIdByLineUserId) {
    const customerId = await deps.findCustomerIdByLineUserId(lineUserId);
    if (!customerId) {
      const text = REGISTER_GATE_TEXT;
      if (opts?.reply !== false && replyToken) {
        const gate = deps.replyRegisterGate ?? deps.reply;
        await gate(replyToken, [{ type: 'text', text }]);
      }
      return { text, nonce: '', version: 0, step: 'mode' };
    }
  }

  // 重啟：清舊 session
  await deps.clearSession(lineUserId);

  const pref = await deps.getPreference(lineUserId);
  const nonce = deps.createNonce();
  const draft = newOptinDraft({ nonce, now: deps.now() });

  // Legacy：已完整設定 → 先摘要閘門（0 preference writes）
  if (isPreferenceComplete(pref)) {
    await deps.upsertSession(lineUserId, OPTIN_FLOW, 'legacy', draft);
    const text = renderLegacyPreferenceSummary({
      contentMode: pref!.contentMode,
      frequency: pref!.frequency,
    });
    if (opts?.reply === false || !replyToken) {
      return { text, nonce: draft.nonce, version: draft.version, step: 'legacy' };
    }
    await deps.reply(replyToken, [
      {
        type: 'text',
        text,
        quickReply: { items: buildLegacyQuickReply(draft) },
      },
    ]);
    return { text, nonce: draft.nonce, version: draft.version, step: 'legacy' };
  }

  await deps.upsertSession(lineUserId, OPTIN_FLOW, 'mode', draft);
  const text = renderModePrompt();
  if (opts?.reply === false || !replyToken) {
    return { text, nonce: draft.nonce, version: draft.version, step: 'mode' };
  }
  await deps.reply(replyToken, [
    {
      type: 'text',
      text,
      quickReply: { items: buildModeQuickReply(draft) },
    },
  ]);
  return { text, nonce: draft.nonce, version: draft.version, step: 'mode' };
}

export async function handleMorningOptinPostback(
  replyToken: string,
  lineUserId: string,
  data: string,
  opts?: {
    webhookEventId?: string | null;
    timestamp?: number | null;
    deps?: Partial<PreferenceFlowDeps>;
  },
): Promise<boolean> {
  const parsed = parseOptinPostbackData(data);
  if (!parsed.ok && parsed.reason === 'not_optin') return false;

  const deps = resolveDeps(opts?.deps);
  const eventKey = resolveOptinEventKey({
    webhookEventId: opts?.webhookEventId,
    timestamp: opts?.timestamp,
    lineUserId,
    postbackData: data,
  });

  if (!parsed.ok) {
    await replyExpired(deps, replyToken, lineUserId);
    return true;
  }

  {
    const byEvent = await deps.findLedgerByEventKey(eventKey);
    if (byEvent?.status === 'SUCCESS') {
      await deps.reply(replyToken, [
        { type: 'text', text: byEvent.successSummary },
      ]);
      return true;
    }
  }

  {
    const nonceHash = hashOptinSessionNonce(parsed.nonce);
    const consumed = await deps.findLedgersByNonceHash(nonceHash);
    if (consumed.length > 0) {
      await replyExpired(deps, replyToken, lineUserId);
      return true;
    }
  }

  const session = await deps.getSession(lineUserId);
  if (!session || session.flow !== OPTIN_FLOW) {
    await replyExpired(deps, replyToken, lineUserId);
    return true;
  }

  const draft = parseMorningOptinDraft(session.payload);
  if (!draft) {
    await replyExpired(deps, replyToken, lineUserId);
    return true;
  }

  const match = assertDraftMatchesPostback({
    draft,
    sessionStep: session.step,
    nonce: parsed.nonce,
    version: parsed.version,
    step: parsed.step,
    now: deps.now(),
  });
  if (!match.ok) {
    await replyExpired(deps, replyToken, lineUserId);
    return true;
  }

  await handleAction(
    deps,
    replyToken,
    lineUserId,
    draft,
    parsed.step,
    parsed.actionId,
    eventKey,
  );
  return true;
}

export async function handleMorningPreferenceMessage(
  replyToken: string,
  lineUserId: string,
  text: string,
  opts?: { deps?: Partial<PreferenceFlowDeps> },
): Promise<boolean> {
  const deps = resolveDeps(opts?.deps);
  const session = await deps.getSession(lineUserId);
  if (!session || session.flow !== OPTIN_FLOW) return false;

  const draft = parseMorningOptinDraft(session.payload);
  if (!draft || isExpiredOrBad(draft, deps.now())) {
    await replyExpired(deps, replyToken, lineUserId);
    return true;
  }
  if (!isOptinFlowStep(session.step)) {
    await replyExpired(deps, replyToken, lineUserId);
    return true;
  }
  const step = normalizeOptinFlowStep(session.step) ?? session.step;

  const cmd = parseMorningCommand(text);
  if (cmd.kind === 'bare_stop') {
    await deps.reply(replyToken, [{ type: 'text', text: MORNING_STOP_CLARIFY }]);
    return true;
  }
  if (cmd.kind === 'settings') {
    // 安全重啟入口，不沿用過期 pending
    await startMorningPreferenceFlow(replyToken, lineUserId, { deps });
    return true;
  }
  if (cmd.kind === 'pause') {
    await deps.clearSession(lineUserId);
    await deps.upsertPreference(lineUserId, { pausedAt: deps.now() });
    await deps.reply(replyToken, [{ type: 'text', text: morningPausedText() }]);
    return true;
  }
  if (cmd.kind === 'resume') {
    await deps.clearSession(lineUserId);
    await deps.upsertPreference(lineUserId, { pausedAt: null });
    await deps.reply(replyToken, [{ type: 'text', text: morningResumedText() }]);
    return true;
  }
  if (cmd.kind === 'unsubscribe') {
    await deps.clearSession(lineUserId);
    await deps.upsertPreference(lineUserId, {
      contentMode: 'off',
      frequency: 'off',
      pausedAt: null,
    });
    await deps.reply(replyToken, [
      { type: 'text', text: morningUnsubscribedText() },
    ]);
    return true;
  }

  if (isTransactionalPassThrough(text)) {
    await deps.clearSession(lineUserId);
    return false;
  }

  const eventKey = `msg:${lineUserId}:${deps.now().getTime()}`;

  if (step === 'legacy') {
    const action = matchLegacyGateActionFromText(text);
    if (action) {
      await handleAction(deps, replyToken, lineUserId, draft, 'legacy', action, eventKey);
      return true;
    }
    await redisplayCurrentStep(deps, replyToken, lineUserId, 'legacy', draft);
    return true;
  }

  if (step === 'mode') {
    const action = matchContentActionFromText(text);
    if (action && isOnboardingModeActionId(action)) {
      await handleAction(deps, replyToken, lineUserId, draft, 'mode', action, eventKey);
      return true;
    }
    await redisplayCurrentStep(deps, replyToken, lineUserId, 'mode', draft);
    return true;
  }

  if (step === 'sample') {
    if (!draft.contentActionId || !isOnboardingModeActionId(draft.contentActionId)) {
      await replyExpired(deps, replyToken, lineUserId);
      return true;
    }
    const action = matchSampleActionFromText(text, draft.contentActionId);
    if (action) {
      await handleAction(deps, replyToken, lineUserId, draft, 'sample', action, eventKey);
      return true;
    }
    await redisplayCurrentStep(deps, replyToken, lineUserId, 'sample', draft);
    return true;
  }

  if (step === 'frequency') {
    const action = matchFrequencyActionFromText(text);
    if (action && action !== 'freq_off') {
      await handleAction(deps, replyToken, lineUserId, draft, 'frequency', action, eventKey);
      return true;
    }
    await redisplayCurrentStep(deps, replyToken, lineUserId, 'frequency', draft);
    return true;
  }

  if (step === 'summary') {
    const action = matchSummaryActionFromText(text);
    if (action) {
      await handleAction(deps, replyToken, lineUserId, draft, 'summary', action, eventKey);
      return true;
    }
    await redisplayCurrentStep(deps, replyToken, lineUserId, 'summary', draft);
    return true;
  }

  await redisplayCurrentStep(deps, replyToken, lineUserId, step, draft);
  return true;
}

function isTransactionalPassThrough(text: string): boolean {
  const parsed = parseLineUserText(text);
  if (parsed.kind === 'unknown') return false;
  if (parsed.kind === 'greeting' || parsed.kind === 'help') return false;
  if (SESSION_BYPASS_KINDS.has(parsed.kind)) return true;
  return (
    parsed.kind === 'jar_code' ||
    parsed.kind === 'bind' ||
    parsed.kind === 'balance' ||
    parsed.kind === 'savings' ||
    parsed.kind === 'status' ||
    parsed.kind === 'rewards_list' ||
    parsed.kind === 'redeem_reward' ||
    parsed.kind === 'unboxing' ||
    parsed.kind === 'events_center' ||
    parsed.kind === 'hub_jar' ||
    parsed.kind === 'hub_chaos' ||
    parsed.kind === 'hub_wild' ||
    parsed.kind === 'comic_roam' ||
    parsed.kind === 'comic_grooming' ||
    parsed.kind === 'comic_home' ||
    parsed.kind === 'bind_help'
  );
}

function isExpiredOrBad(draft: MorningOptinDraft, now: Date): boolean {
  const exp = Date.parse(draft.expiresAt);
  return Number.isNaN(exp) || now.getTime() >= exp;
}

export async function handleMorningGlobalCommand(
  replyToken: string,
  lineUserId: string,
  text: string,
  opts?: { deps?: Partial<PreferenceFlowDeps> },
): Promise<boolean> {
  const deps = resolveDeps(opts?.deps);
  const cmd = parseMorningCommand(text);
  if (cmd.kind === 'none') return false;

  if (cmd.kind === 'bare_stop') {
    await deps.reply(replyToken, [{ type: 'text', text: MORNING_STOP_CLARIFY }]);
    return true;
  }
  if (cmd.kind === 'settings') {
    await startMorningPreferenceFlow(replyToken, lineUserId, { deps });
    return true;
  }
  if (cmd.kind === 'pause') {
    await deps.upsertPreference(lineUserId, { pausedAt: deps.now() });
    await deps.reply(replyToken, [{ type: 'text', text: morningPausedText() }]);
    return true;
  }
  if (cmd.kind === 'resume') {
    await deps.upsertPreference(lineUserId, { pausedAt: null });
    const pref = await deps.getPreference(lineUserId);
    if (!isPreferenceComplete(pref)) {
      await startMorningPreferenceFlow(replyToken, lineUserId, { deps });
      return true;
    }
    await deps.reply(replyToken, [{ type: 'text', text: morningResumedText() }]);
    return true;
  }
  if (cmd.kind === 'unsubscribe') {
    await deps.upsertPreference(lineUserId, {
      contentMode: 'off',
      frequency: 'off',
      pausedAt: null,
    });
    await deps.reply(replyToken, [
      { type: 'text', text: morningUnsubscribedText() },
    ]);
    return true;
  }

  if (cmd.kind === 'content_mode' || cmd.kind === 'frequency') {
    await startMorningPreferenceFlow(replyToken, lineUserId, { deps });
    return true;
  }

  return false;
}

export async function peekMorningOptinDraft(
  lineUserId: string,
  deps?: Partial<PreferenceFlowDeps>,
): Promise<{ step: string; draft: MorningOptinDraft } | null> {
  const d = resolveDeps(deps);
  const session = await d.getSession(lineUserId);
  if (!session || session.flow !== OPTIN_FLOW) return null;
  const draft = parseMorningOptinDraft(session.payload);
  if (!draft) return null;
  return { step: session.step, draft };
}

export type { MorningOptinDraft, MorningPreferenceRow };
