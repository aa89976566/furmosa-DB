/**
 * 開箱入口／選品的純決策（無 DB）。
 * 進行中 session 重送入口 keyword → replay，不可重設。
 */
import {
  FLOW_STATE,
  parseJibaProductKey,
  type FlowState,
  type JibaProductKey,
} from '@/lib/campaigns/jiba-two-piece/constants';
import { isJibaBriefContinue } from '@/lib/campaigns/jiba-two-piece/copy';
import { isDeclineIntent, isJoinIntent } from '@/lib/campaigns/jiba-two-piece/validation';
import { isJibaUnboxEntryIntent } from '@/lib/line/campaigns/jiba-unbox/intent';

export type JibaTurnDecision =
  | { action: 'invite' }
  | { action: 'replay'; state: FlowState }
  | { action: 'resume_choice' }
  | { action: 'join' }
  | { action: 'decline' }
  | { action: 'pick_product'; productKey: JibaProductKey }
  | { action: 'continue_brief' }
  | { action: 'reprompt_invite' }
  | { action: 'reprompt_product' }
  | { action: 'pass' };

export type JibaTurnContext = {
  text: string;
  /** lineChatSession.flow === jiba_unbox，或已有進行中 conversation */
  sessionActive: boolean;
  pausedForRegister: boolean;
  hasApplication: boolean;
  state: FlowState | null;
};

function currentState(ctx: Pick<JibaTurnContext, 'state'>): FlowState {
  return ctx.state ?? FLOW_STATE.CAMPAIGN_INTRO;
}

/** 入口（無文字或只判斷 session）：邀請 / 重播 / 續辦選擇 */
export function decideJibaUnboxEntry(
  ctx: Omit<JibaTurnContext, 'text'>,
): Extract<JibaTurnDecision, { action: 'invite' | 'replay' | 'resume_choice' }> {
  if (ctx.pausedForRegister && ctx.hasApplication) {
    return { action: 'resume_choice' };
  }
  if (ctx.sessionActive || ctx.hasApplication) {
    return { action: 'replay', state: currentState(ctx) };
  }
  return { action: 'invite' };
}

function isInviteState(state: FlowState | null): boolean {
  return (
    state == null ||
    state === FLOW_STATE.CAMPAIGN_INTRO ||
    state === FLOW_STATE.SHOW_RULES
  );
}

/** 進行中對話的一則文字要做什麼 */
export function decideJibaUnboxMessage(ctx: JibaTurnContext): JibaTurnDecision {
  const trimmed = ctx.text.trim();
  if (!trimmed) return { action: 'pass' };

  if (isJibaUnboxEntryIntent(trimmed)) {
    return decideJibaUnboxEntry(ctx);
  }

  if (!ctx.hasApplication && ctx.sessionActive && isInviteState(ctx.state)) {
    if (isDeclineIntent(trimmed)) return { action: 'decline' };
    if (isJoinIntent(trimmed) || /^這個我可以！$/.test(trimmed)) {
      return { action: 'join' };
    }
    return { action: 'reprompt_invite' };
  }

  if (ctx.state === FLOW_STATE.ASK_PRODUCT) {
    if (isDeclineIntent(trimmed)) return { action: 'decline' };
    const productKey = parseJibaProductKey(trimmed);
    if (productKey) return { action: 'pick_product', productKey };
    return { action: 'reprompt_product' };
  }

  if (ctx.state === FLOW_STATE.SHOW_BRIEF && isJibaBriefContinue(trimmed)) {
    return { action: 'continue_brief' };
  }

  return { action: 'pass' };
}
