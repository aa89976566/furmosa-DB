import { FLOW_STATE, type FlowState } from '@/lib/campaigns/jiba-two-piece/constants';

/** 開箱既有運送欄位：收件人、手機、超商門市／地址 */
export type JibaShippingSnapshot = {
  recipientName?: string | null;
  recipientPhone?: string | null;
  storeName?: string | null;
  storeAddress?: string | null;
};

export function hasFilled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function isJibaShippingComplete(snapshot: JibaShippingSnapshot): boolean {
  return (
    hasFilled(snapshot.recipientName) &&
    hasFilled(snapshot.recipientPhone) &&
    hasFilled(snapshot.storeName)
  );
}

/** 缺哪一格運送資訊，就回到那一格；齊了回 null */
export function nextJibaShippingState(snapshot: JibaShippingSnapshot): FlowState | null {
  if (!hasFilled(snapshot.recipientName)) return FLOW_STATE.ASK_RECIPIENT_NAME;
  if (!hasFilled(snapshot.recipientPhone)) return FLOW_STATE.ASK_RECIPIENT_PHONE;
  if (!hasFilled(snapshot.storeName)) return FLOW_STATE.ASK_STORE;
  return null;
}

export function shippingSnapshotFrom(
  app?: {
    recipientName?: string | null;
    recipientPhone?: string | null;
    storeName?: string | null;
    storeAddress?: string | null;
  } | null,
  collected?: Record<string, unknown> | null,
): JibaShippingSnapshot {
  const str = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value : null;
  return {
    recipientName: app?.recipientName || str(collected?.recipientName),
    recipientPhone: app?.recipientPhone || str(collected?.recipientPhone),
    storeName: app?.storeName || str(collected?.storeName),
    storeAddress: app?.storeAddress || str(collected?.storeAddress),
  };
}

/**
 * 舊 session 若停在提前的加購（舊 SHOW_BRIEF 混加購，或新 ASK_UPSELL 但收件未齊），
 * 先導回缺的運送欄位。其他 state 原步續接，不重設、不跳步。
 */
export function resolveJibaResumeState(
  state: FlowState,
  snapshot: JibaShippingSnapshot,
): FlowState {
  if (state !== FLOW_STATE.ASK_UPSELL) return state;
  return nextJibaShippingState(snapshot) ?? FLOW_STATE.ASK_UPSELL;
}

/** 新申請快樂路徑：加購一定在運送資訊之後 */
export const JIBA_COLLECTING_SEQUENCE = [
  FLOW_STATE.CAMPAIGN_INTRO,
  FLOW_STATE.ASK_PRODUCT,
  FLOW_STATE.SHOW_BRIEF,
  FLOW_STATE.ASK_RECIPIENT_NAME,
  FLOW_STATE.ASK_RECIPIENT_PHONE,
  FLOW_STATE.ASK_STORE,
  FLOW_STATE.CONFIRM_STORE,
  FLOW_STATE.ASK_UPSELL,
  FLOW_STATE.ASK_INSTAGRAM,
  FLOW_STATE.ASK_PET_NAME,
  FLOW_STATE.ASK_CONTENT_LICENSE,
  FLOW_STATE.SHOW_ORDER_CONFIRMATION,
  FLOW_STATE.PENDING_REVIEW,
] as const;

export function jibaSequenceIndex(state: FlowState): number {
  return (JIBA_COLLECTING_SEQUENCE as readonly string[]).indexOf(state);
}

export function isJibaUpsellBeforeShipping(state: FlowState): boolean {
  const upsellAt = jibaSequenceIndex(FLOW_STATE.ASK_UPSELL);
  const storeAt = jibaSequenceIndex(FLOW_STATE.CONFIRM_STORE);
  const stateAt = jibaSequenceIndex(state);
  if (upsellAt < 0 || storeAt < 0 || stateAt < 0) return false;
  return state === FLOW_STATE.ASK_UPSELL && stateAt < storeAt;
}
