/**
 * LineChatSession payload：僅短期 draft（nonce／version／choices）
 * Confirm 成功結果不得寫入此處 — 見 LineMorningPreferenceConfirmLedger
 */

import type {
  OptinContentActionId,
  OptinFrequencyActionId,
} from '@/lib/line/morning/domain/optin/options';
import {
  OPTIN_SESSION_TTL_MS,
  normalizeOptinFlowStep,
  type OptinFlowStep,
} from '@/lib/line/morning/domain/optin/postback';

export type MorningOptinDraft = {
  version: number;
  /** 短期 draft 用 opaque nonce；confirm ledger 只存 hash */
  nonce: string;
  expiresAt: string;
  /** pendingMode（brief-first）；confirm 前不寫 preference */
  contentActionId?: OptinContentActionId;
  frequencyActionId?: OptinFrequencyActionId;
};

export function parseMorningOptinDraft(payload: string): MorningOptinDraft | null {
  try {
    const raw = JSON.parse(payload) as Partial<MorningOptinDraft>;
    if (
      typeof raw.version !== 'number' ||
      typeof raw.nonce !== 'string' ||
      typeof raw.expiresAt !== 'string'
    ) {
      return null;
    }
    return {
      version: raw.version,
      nonce: raw.nonce,
      expiresAt: raw.expiresAt,
      contentActionId: raw.contentActionId,
      frequencyActionId: raw.frequencyActionId,
    };
  } catch {
    return null;
  }
}

export function isOptinDraftExpired(
  draft: MorningOptinDraft,
  now: Date = new Date(),
): boolean {
  const exp = Date.parse(draft.expiresAt);
  if (Number.isNaN(exp)) return true;
  return now.getTime() >= exp;
}

export function newOptinDraft(input: {
  nonce: string;
  now?: Date;
  ttlMs?: number;
}): MorningOptinDraft {
  const now = input.now ?? new Date();
  const ttl = input.ttlMs ?? OPTIN_SESSION_TTL_MS;
  return {
    version: 1,
    nonce: input.nonce,
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
  };
}

export function assertDraftMatchesPostback(input: {
  draft: MorningOptinDraft;
  sessionStep: string;
  nonce: string;
  version: number;
  step: OptinFlowStep;
  now?: Date;
}): { ok: true } | { ok: false; reason: 'expired' | 'mismatch' } {
  if (isOptinDraftExpired(input.draft, input.now)) {
    return { ok: false, reason: 'expired' };
  }
  if (input.draft.nonce !== input.nonce) {
    return { ok: false, reason: 'mismatch' };
  }
  if (input.draft.version !== input.version) {
    return { ok: false, reason: 'mismatch' };
  }
  const sessionNorm = normalizeOptinFlowStep(input.sessionStep);
  const stepNorm = normalizeOptinFlowStep(input.step);
  if (!sessionNorm || !stepNorm || sessionNorm !== stepNorm) {
    return { ok: false, reason: 'mismatch' };
  }
  return { ok: true };
}
