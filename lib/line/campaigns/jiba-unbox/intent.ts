import {
  FLOW_STATE,
  parseJibaProductKey,
  type FlowState,
  type JibaProductKey,
} from '@/lib/campaigns/jiba-two-piece/constants';
import { isJibaBriefContinue } from '@/lib/campaigns/jiba-two-piece/copy';
import { isJoinIntent } from '@/lib/campaigns/jiba-two-piece/validation';

/**
 * 開箱 UGC 入口 keyword（正規化後精確比對，不用 contains）。
 * 既有別名一併收斂，避免「開箱任務」與「毛孩來開箱」落到青蛙／嗷嗚。
 */
export const JIBA_UNBOX_INTENT_PHRASES = [
  '開箱',
  '開箱文',
  '開箱任務',
  'ugc',
  '試吃開箱',
  '開箱合作',
  '合作開箱',
  '毛孩來開箱',
  '來開箱',
  '開箱研究',
] as const;

const INTENT_SET = new Set<string>(JIBA_UNBOX_INTENT_PHRASES);

/** 先不用：邀請頁明確拒絕；進行中則安全取消，不留可誤續草稿 */
export const JIBA_INVITE_DECLINE_RE = /^(?:先不用|這次先不要|先不要)$/i;

export function normalizeJibaUnboxIntentText(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFKC')
    .replace(/^[\s\p{P}\p{S}]+/u, '')
    .replace(/[\s\p{P}\p{S}]+$/u, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function isJibaUnboxIntent(raw: string): boolean {
  const normalized = normalizeJibaUnboxIntentText(raw);
  return normalized.length > 0 && INTENT_SET.has(normalized);
}

export function isJibaInviteDecline(raw: string): boolean {
  return JIBA_INVITE_DECLINE_RE.test(raw.trim());
}

export type JibaUnboxTurn =
  | { kind: 'invite' }
  | { kind: 'reprompt'; state: string }
  | { kind: 'join' }
  | { kind: 'decline' }
  | { kind: 'pick_product'; productKey: JibaProductKey }
  | { kind: 'brief_continue' }
  | { kind: 'continue_flow' }
  | { kind: 'ignore' };

/**
 * 入口／重入決策（純函式，供測試與 flow 共用）。
 * 進行中 session 重送 keyword → 重送當前步驟，不重設。
 */
export function resolveJibaUnboxTurn(input: {
  sessionActive: boolean;
  currentState: string | null;
  hasApplication: boolean;
  text: string;
}): JibaUnboxTurn {
  const state = input.currentState;
  const atInvite =
    !state ||
    state === FLOW_STATE.CAMPAIGN_INTRO ||
    state === FLOW_STATE.SHOW_RULES;

  if (isJibaUnboxIntent(input.text)) {
    if (input.sessionActive) {
      return { kind: 'reprompt', state: state || FLOW_STATE.CAMPAIGN_INTRO };
    }
    return { kind: 'invite' };
  }

  if (isJibaInviteDecline(input.text)) {
    if (input.sessionActive || input.hasApplication || atInvite) {
      return { kind: 'decline' };
    }
    return { kind: 'ignore' };
  }

  if (!input.sessionActive) return { kind: 'ignore' };

  if (atInvite && (isJoinIntent(input.text) || /^這個我可以！$/.test(input.text.trim()))) {
    return { kind: 'join' };
  }

  if (state === FLOW_STATE.ASK_PRODUCT) {
    const productKey = parseJibaProductKey(input.text);
    if (productKey) return { kind: 'pick_product', productKey };
  }

  if (state === FLOW_STATE.SHOW_BRIEF && isJibaBriefContinue(input.text)) {
    return { kind: 'brief_continue' };
  }

  return { kind: 'continue_flow' };
}

export function isInviteState(state: string | null | undefined): boolean {
  return (
    !state ||
    state === FLOW_STATE.CAMPAIGN_INTRO ||
    state === FLOW_STATE.SHOW_RULES
  );
}

export type { FlowState };
