/**
 * Phase 4B-B CONSENSUS postback 契約
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

/** Session 步驟（confirm 成功後清 session；不使用 confirmed 步驟存結果） */
export type OptinFlowStep = 'content' | 'frequency' | 'summary';

export const OPTIN_FLOW_STEPS = ['content', 'frequency', 'summary'] as const;

export function isOptinFlowStep(v: string): v is OptinFlowStep {
  return (OPTIN_FLOW_STEPS as readonly string[]).includes(v);
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
  const params = new URLSearchParams();
  params.set('lmpref', '1');
  params.set('n', input.nonce);
  params.set('v', String(input.version));
  params.set('s', input.step);
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
  // 拒絕客戶端夾帶 mode／label（防信任漂移）
  if (params.has('mode') || params.has('label') || params.has('contentMode')) {
    return { ok: false, reason: 'forbidden_field' };
  }
  const nonce = params.get('n') ?? '';
  const versionRaw = params.get('v') ?? '';
  const step = params.get('s') ?? '';
  const actionId = params.get('a') ?? '';
  if (!/^[0-9a-f]{32}$/i.test(nonce)) {
    return { ok: false, reason: 'bad_nonce' };
  }
  const version = Number(versionRaw);
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, reason: 'bad_version' };
  }
  if (!isOptinFlowStep(step)) {
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

/** confirm ledger 用：偏好 snapshot digest（byte-stable） */
export function digestOptinConfirmPayload(input: {
  contentActionId: string;
  frequencyActionId: string;
  storageMode: string;
  storageFrequency: string;
}): string {
  const canonical = [
    input.contentActionId,
    input.frequencyActionId,
    input.storageMode,
    input.storageFrequency,
  ].join('|');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** webhook 冪等 event key：優先 webhookEventId */
export function resolveOptinEventKey(input: {
  webhookEventId?: string | null;
  timestamp?: number | null;
  lineUserId: string;
  postbackData: string;
}): string {
  if (input.webhookEventId && input.webhookEventId.trim()) {
    return `wev:${input.webhookEventId.trim()}`;
  }
  const ts = input.timestamp ?? 0;
  const h = createHash('sha256')
    .update(`${ts}|${input.lineUserId}|${input.postbackData}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return `syn:${h}`;
}
