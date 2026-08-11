/**
 * Sample-first CONSENSUS postback 契約
 * payload 只帶 nonce + step/version + allowlisted action id
 * server 不信任 label／mode
 */

import { createHash, randomBytes } from 'node:crypto';
import {
  isAllowlistedOptinActionId,
  type OptinActionId,
} from '@/lib/line/morning/domain/optin/options';

export const OPTIN_POSTBACK_PREFIX = 'lmpref=1';
export const OPTIN_SESSION_TTL_MS = 30 * 60 * 1000;
export const OPTIN_FLOW = 'morning_prefs' as const;

/**
 * Session 步驟
 * mode → sample → frequency → summary
 * legacy：已有設定時的維持／探索閘門
 */
export type OptinFlowStep =
  | 'mode'
  | 'sample'
  | 'frequency'
  | 'summary'
  | 'legacy'
  /** @deprecated alias → mode（舊 session／測試相容） */
  | 'content';

export const OPTIN_FLOW_STEPS = [
  'mode',
  'sample',
  'frequency',
  'summary',
  'legacy',
  'content',
] as const;

export function isOptinFlowStep(v: string): v is OptinFlowStep {
  return (OPTIN_FLOW_STEPS as readonly string[]).includes(v);
}

export function normalizeOptinFlowStep(step: string): OptinFlowStep | null {
  if (!isOptinFlowStep(step)) return null;
  if (step === 'content') return 'mode';
  return step;
}

export function createOptinNonce(): string {
  return randomBytes(16).toString('hex');
}

export function buildOptinPostbackData(input: {
  nonce: string;
  version: number;
  step: OptinFlowStep;
  actionId: OptinActionId;
}): string {
  if (!isAllowlistedOptinActionId(input.actionId)) {
    throw new Error(`optin action not allowlisted: ${input.actionId}`);
  }
  const step = input.step === 'content' ? 'mode' : input.step;
  const params = new URLSearchParams();
  params.set('lmpref', '1');
  params.set('n', input.nonce);
  params.set('v', String(input.version));
  params.set('s', step);
  params.set('a', input.actionId);
  return params.toString();
}

export type ParsedOptinPostback =
  | {
      ok: true;
      nonce: string;
      version: number;
      step: OptinFlowStep;
      actionId: OptinActionId;
    }
  | { ok: false; reason: string };

export function parseOptinPostbackData(data: string): ParsedOptinPostback {
  if (!data.startsWith('lmpref=') && !data.includes('lmpref=')) {
    return { ok: false, reason: 'not_optin' };
  }
  const params = new URLSearchParams(data);
  if (params.get('lmpref') !== '1') {
    return { ok: false, reason: 'not_optin' };
  }
  if (params.has('mode') || params.has('label') || params.has('contentMode')) {
    return { ok: false, reason: 'forbidden_field' };
  }
  const nonce = params.get('n') ?? '';
  const versionRaw = params.get('v') ?? '';
  const stepRaw = params.get('s') ?? '';
  const actionId = params.get('a') ?? '';
  if (!/^[0-9a-f]{32}$/i.test(nonce)) {
    return { ok: false, reason: 'bad_nonce' };
  }
  const version = Number(versionRaw);
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, reason: 'bad_version' };
  }
  const step = normalizeOptinFlowStep(stepRaw);
  if (!step) {
    return { ok: false, reason: 'bad_step' };
  }
  if (!isAllowlistedOptinActionId(actionId)) {
    return { ok: false, reason: 'bad_action' };
  }
  return { ok: true, nonce, version, step, actionId };
}

export function isOptinPostbackData(data: string): boolean {
  return parseOptinPostbackData(data).ok || data.includes('lmpref=1');
}

export function digestOptinConfirmPayload(input: {
  contentActionId: string;
  frequencyActionId: string;
  storageMode: string;
  storageFrequency: string;
}): string {
  const canonical = JSON.stringify({
    contentActionId: input.contentActionId,
    frequencyActionId: input.frequencyActionId,
    storageMode: input.storageMode,
    storageFrequency: input.storageFrequency,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function resolveOptinEventKey(input: {
  webhookEventId?: string | null;
  timestamp?: number | null;
  lineUserId: string;
  postbackData: string;
}): string {
  if (input.webhookEventId && input.webhookEventId.trim()) {
    return `wh:${input.webhookEventId.trim()}`;
  }
  const ts = input.timestamp ?? Date.now();
  const digest = createHash('sha256')
    .update(`${input.lineUserId}|${ts}|${input.postbackData}`)
    .digest('hex')
    .slice(0, 32);
  return `fb:${digest}`;
}
