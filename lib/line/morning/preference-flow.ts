/**
 * Phase 4B-B CONSENSUS：明確 re-opt-in 偏好對話
 * content → frequency → summary → confirm
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
  OPTIN_ABORT_FREE_TEXT_REPLY,
  buildOptinPostbackData,
  createOptinNonce,
  digestOptinConfirmPayload,
  getContentOption,
  getFrequencyOption,
  isOptinContentActionId,
  isOptinFrequencyActionId,
  listContentOptionsForUser,
  matchContentActionFromText,
  matchFrequencyActionFromText,
  matchSummaryActionFromText,
  newOptinDraft,
  parseMorningOptinDraft,
  parseOptinPostbackData,
  renderContentPrompt,
  renderFrequencyPrompt,
  renderOptinSuccessSummary,
  renderOptinSummary,
  resolveOptinEventKey,
  assertDraftMatchesPostback,
  isOptinFlowStep,
  OPTIN_FLOW,
  OPTIN_FREQUENCY_OPTIONS,
  type MorningOptinDraft,
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
  /**
   * preference upsert + ledger create 必須同交易。
   * 回呼內應使用 tx 上的寫入方法，避免跨 client。
   */
  runConfirmTransaction: <T>(
    fn: (tx: ConfirmTxClient) => Promise<T>,
  ) => Promise<T>;
};

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

function buildContentQuickReply(
  draft: MorningOptinDraft,
  currentStorageMode: string | null | undefined,
): LineQuickReplyItem[] {
  return listContentOptionsForUser(currentStorageMode).map((opt) =>
    qrPostback(
      opt.buttonLabel,
      buildOptinPostbackData({
        nonce: draft.nonce,
        version: draft.version,
        step: 'content',
        actionId: opt.actionId,
      }),
      opt.buttonLabel,
    ),
  );
}

function buildFrequencyQuickReply(draft: MorningOptinDraft): LineQuickReplyItem[] {
  return OPTIN_FREQUENCY_OPTIONS.map((opt) =>
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

async function replyExpired(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
): Promise<void> {
  await deps.clearSession(lineUserId);
  await deps.reply(replyToken, [{ type: 'text', text: OPTIN_EXPIRED_REPLY }]);
}

async function abortDraft(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
  text: string,
): Promise<void> {
  await deps.clearSession(lineUserId);
  await deps.reply(replyToken, [{ type: 'text', text }]);
}

/** 交易／導覽指令：清 draft、交回原 handler（不吞） */
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

/**
 * 開啟偏好流程（preference 0 writes；只寫 LineChatSession draft）
 */
export async function startMorningPreferenceFlow(
  replyToken: string | null,
  lineUserId: string,
  opts?: {
    fromSettings?: boolean;
    reply?: boolean;
    deps?: Partial<PreferenceFlowDeps>;
  },
): Promise<{ text: string; nonce: string; version: number }> {
  const deps = resolveDeps(opts?.deps);
  const pref = await deps.getPreference(lineUserId);
  const nonce = deps.createNonce();
  const draft = newOptinDraft({ nonce, now: deps.now() });
  await deps.upsertSession(lineUserId, OPTIN_FLOW, 'content', draft);
  const text = renderContentPrompt({
    currentStorageMode: pref?.contentMode ?? null,
  });
  const items = buildContentQuickReply(draft, pref?.contentMode ?? null);

  if (opts?.reply === false || !replyToken) {
    return { text, nonce: draft.nonce, version: draft.version };
  }
  await deps.reply(replyToken, [
    {
      type: 'text',
      text,
      quickReply: { items },
    },
  ]);
  return { text, nonce: draft.nonce, version: draft.version };
}

async function advanceToFrequency(
  deps: PreferenceFlowDeps,
  replyToken: string,
  lineUserId: string,
  draft: MorningOptinDraft,
  contentActionId: OptinContentActionId,
): Promise<void> {
  // E 先不用：略過頻率，直接摘要（frequency=off）
  if (contentActionId === 'content_e') {
    const next: MorningOptinDraft = {
      ...draft,
      version: draft.version + 1,
      contentActionId,
      frequencyActionId: 'freq_off',
    };
    await deps.upsertSession(lineUserId, OPTIN_FLOW, 'summary', next);
    const content = getContentOption(contentActionId)!;
    const frequency = getFrequencyOption('freq_off')!;
    await deps.reply(replyToken, [
      {
        type: 'text',
        text: renderOptinSummary({ content, frequency }),
        quickReply: { items: buildSummaryQuickReply(next) },
      },
    ]);
    return;
  }

  const next: MorningOptinDraft = {
    ...draft,
    version: draft.version + 1,
    contentActionId,
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
  // 同 event key 但 digest/version/nonce 不一致 → 拒絕（0 writes）
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

  // 相同 webhook redelivery → 0 additional writes + byte-stable 重播
  // （查詢不用 expiresAt／now）
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

  // nonce 已消費但 event／digest／version 不同 → 拒絕
  const byNonce = await deps.findLedgersByNonceHash(sessionNonceHash);
  if (byNonce.length > 0) {
    await replyExpired(deps, replyToken, lineUserId);
    return;
  }

  let wrote = false;
  try {
    await deps.runConfirmTransaction(async (tx) => {
      // 交易內再查 event（防競態 redelivery；不用 expiresAt）
      const again = await tx.findLedgerByEventKey(eventKey);
      if (again) {
        return;
      }
      const nonceHit = await tx.findLedgersByNonceHash(sessionNonceHash);
      if (nonceHit.length > 0) {
        return;
      }

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
      // 成功結果不留在 Session（避免被新 flow 覆寫）；清 draft
      await tx.clearSession(lineUserId);
      wrote = true;
    });
  } catch (err) {
    // unique 衝突：可能並發同 event redelivery
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
  if (sessionStep === 'content') {
    if (!isOptinContentActionId(actionId)) {
      await replyExpired(deps, replyToken, lineUserId);
      return;
    }
    // legacy alternate 僅在目前為 alternate 時允許
    if (actionId === 'content_legacy_alternate') {
      const pref = await deps.getPreference(lineUserId);
      if (pref?.contentMode !== 'alternate') {
        await replyExpired(deps, replyToken, lineUserId);
        return;
      }
    }
    await advanceToFrequency(deps, replyToken, lineUserId, draft, actionId);
    return;
  }

  if (sessionStep === 'frequency') {
    if (!isOptinFrequencyActionId(actionId)) {
      await replyExpired(deps, replyToken, lineUserId);
      return;
    }
    await advanceToSummary(deps, replyToken, lineUserId, draft, actionId);
    return;
  }

  if (sessionStep === 'summary') {
    if (actionId === 'cancel') {
      await abortDraft(deps, replyToken, lineUserId, OPTIN_CANCEL_REPLY);
      return;
    }
    if (actionId === 'confirm') {
      await applyConfirm(deps, replyToken, lineUserId, draft, eventKey);
      return;
    }
    await replyExpired(deps, replyToken, lineUserId);
    return;
  }

  await replyExpired(deps, replyToken, lineUserId);
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

  // Session 可能已被清掉：相同 event redelivery 仍須靠 DB ledger 重播
  // （correctness 不依賴 TTL／Session）
  {
    const byEvent = await deps.findLedgerByEventKey(eventKey);
    if (byEvent?.status === 'SUCCESS') {
      await deps.reply(replyToken, [
        { type: 'text', text: byEvent.successSummary },
      ]);
      return true;
    }
  }

  // 歷史按鈕／已消費 nonce（不同 event）→ 過期（0 writes）
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

  const cmd = parseMorningCommand(text);
  if (cmd.kind === 'bare_stop') {
    await deps.reply(replyToken, [{ type: 'text', text: MORNING_STOP_CLARIFY }]);
    return true;
  }
  if (cmd.kind === 'settings') {
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

  // 交易指令：中止 draft、0 preference writes（除清 session）、交回 handler
  if (isTransactionalPassThrough(text)) {
    await deps.clearSession(lineUserId);
    return false;
  }

  const eventKey = `msg:${lineUserId}:${deps.now().getTime()}`;

  if (session.step === 'content') {
    const action = matchContentActionFromText(text);
    if (action) {
      await handleAction(
        deps,
        replyToken,
        lineUserId,
        draft!,
        'content',
        action,
        eventKey,
      );
      return true;
    }
  }

  if (session.step === 'frequency') {
    const action = matchFrequencyActionFromText(text);
    if (action) {
      await handleAction(
        deps,
        replyToken,
        lineUserId,
        draft!,
        'frequency',
        action,
        eventKey,
      );
      return true;
    }
  }

  if (session.step === 'summary') {
    const action = matchSummaryActionFromText(text);
    if (action) {
      await handleAction(
        deps,
        replyToken,
        lineUserId,
        draft!,
        'summary',
        action,
        eventKey,
      );
      return true;
    }
  }

  // 一般自由文字：中止、清 draft、0 preference writes
  await abortDraft(deps, replyToken, lineUserId, OPTIN_ABORT_FREE_TEXT_REPLY);
  return true;
}

function isExpiredOrBad(draft: MorningOptinDraft, now: Date): boolean {
  const exp = Date.parse(draft.expiresAt);
  return Number.isNaN(exp) || now.getTime() >= exp;
}

/**
 * 全域早安指令（非 session）：僅設定／暫停／恢復／退訂／裸停止
 * 內容／頻率關鍵字不再直接寫入（必須走 confirm 流程）
 */
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

  // content_mode / frequency 全域捷徑：改引導進設定，不直接寫
  if (cmd.kind === 'content_mode' || cmd.kind === 'frequency') {
    await startMorningPreferenceFlow(replyToken, lineUserId, { deps });
    return true;
  }

  return false;
}

/** 測試／HQ 用：讀取目前 draft（不寫入） */
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
