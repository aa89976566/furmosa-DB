import {
  APP_STATUS,
  FLOW_STATE,
  JIBA_FREE_SHIP,
  JIBA_SHIPPING_FEE,
  PAYMENT_STATUS,
  parseCollectedDataJson,
  type AppStatus,
  type FlowState,
} from '@/lib/campaigns/jiba-two-piece/constants';

export const JIBA_PAYMENT_METHOD_BANK_TRANSFER = 'bank_transfer' as const;

export type JibaShippingFeeReason = 'due' | 'free_cvs' | 'free_blackcat' | 'waived';

export type JibaShippingFeeAssessment = {
  due: boolean;
  amount: number;
  reason: JibaShippingFeeReason;
};

export type JibaPaymentDeclaration = {
  paymentMethod: typeof JIBA_PAYMENT_METHOD_BANK_TRANSFER;
  declaredPaidAt: string;
  declaredAmount: number;
  transferAccountLast5: string;
};

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function assessJibaShippingFee(
  collected: Record<string, unknown> | string | null | undefined,
): JibaShippingFeeAssessment {
  const data =
    typeof collected === 'string' || collected == null
      ? parseCollectedDataJson(collected)
      : collected;

  if (data.shippingFeeWaived === true || data.shippingFeeDue === false) {
    return { due: false, amount: 0, reason: 'waived' };
  }

  const amount = num(data.upsellAmount) ?? num(data.upsellSubtotal) ?? 0;
  const method = typeof data.shippingMethod === 'string' ? data.shippingMethod : 'convenience';
  if (method === 'home' || method === 'blackCat') {
    if (amount >= JIBA_FREE_SHIP.blackCat) {
      return { due: false, amount: 0, reason: 'free_blackcat' };
    }
  }
  if (amount >= JIBA_FREE_SHIP.cvs711) {
    return { due: false, amount: 0, reason: 'free_cvs' };
  }
  return { due: true, amount: JIBA_SHIPPING_FEE, reason: 'due' };
}

export function isJibaPaymentDeclared(
  paymentStatus: string | null | undefined,
  collected?: Record<string, unknown> | string | null,
): boolean {
  if (
    paymentStatus === PAYMENT_STATUS.DECLARED ||
    paymentStatus === PAYMENT_STATUS.AWAITING_VERIFICATION ||
    paymentStatus === PAYMENT_STATUS.PAID ||
    paymentStatus === PAYMENT_STATUS.WAIVED
  ) {
    return true;
  }
  const data =
    typeof collected === 'string' || collected == null
      ? parseCollectedDataJson(collected)
      : collected;
  return typeof data.declaredPaidAt === 'string' && data.declaredPaidAt.length > 0;
}

export function isJibaPaymentSatisfied(input: {
  paymentStatus?: string | null;
  collected?: Record<string, unknown> | string | null;
}): boolean {
  const fee = assessJibaShippingFee(input.collected);
  if (!fee.due) return true;
  return isJibaPaymentDeclared(input.paymentStatus, input.collected);
}

export function buildPaymentDeclarationPatch(opts: {
  declaredAt?: Date;
  accountLast5: string;
  amount?: number;
}): JibaPaymentDeclaration {
  return {
    paymentMethod: JIBA_PAYMENT_METHOD_BANK_TRANSFER,
    declaredPaidAt: (opts.declaredAt ?? new Date()).toISOString(),
    declaredAmount: opts.amount ?? JIBA_SHIPPING_FEE,
    transferAccountLast5: opts.accountLast5,
  };
}

export function paymentDeclarationFromCollected(
  collected: Record<string, unknown> | string | null | undefined,
): JibaPaymentDeclaration | null {
  const data =
    typeof collected === 'string' || collected == null
      ? parseCollectedDataJson(collected)
      : collected;
  const declaredPaidAt =
    typeof data.declaredPaidAt === 'string' ? data.declaredPaidAt : null;
  const last5 =
    typeof data.transferAccountLast5 === 'string' ? data.transferAccountLast5 : '';
  if (!declaredPaidAt) return null;
  return {
    paymentMethod: JIBA_PAYMENT_METHOD_BANK_TRANSFER,
    declaredPaidAt,
    declaredAmount: num(data.declaredAmount) ?? JIBA_SHIPPING_FEE,
    transferAccountLast5: last5,
  };
}

const COLLECTING_AFTER_UPSELL: ReadonlySet<string> = new Set([
  FLOW_STATE.ASK_TRANSFER,
  FLOW_STATE.ASK_INSTAGRAM,
  FLOW_STATE.ASK_PET_NAME,
  FLOW_STATE.ASK_CONTENT_LICENSE,
  FLOW_STATE.SHOW_ORDER_CONFIRMATION,
  FLOW_STATE.EDIT_FIELD_SELECTION,
]);

const TERMINAL_OR_REVIEW: ReadonlySet<string> = new Set([
  FLOW_STATE.PENDING_REVIEW,
  FLOW_STATE.AWAITING_SHIPPING_PAYMENT,
  FLOW_STATE.READY_TO_SHIP,
  FLOW_STATE.CANCELLED,
]);

export function isJibaCollectingAfterUpsell(state: FlowState): boolean {
  return COLLECTING_AFTER_UPSELL.has(state);
}

export function shouldRedirectToTransfer(opts: {
  state: FlowState;
  collected?: Record<string, unknown> | string | null;
  paymentStatus?: string | null;
}): boolean {
  if (TERMINAL_OR_REVIEW.has(opts.state)) return false;
  if (!isJibaCollectingAfterUpsell(opts.state)) return false;
  const data =
    typeof opts.collected === 'string' || opts.collected == null
      ? parseCollectedDataJson(opts.collected)
      : opts.collected;
  if (data.upsellAsked !== true) return false;
  if (!assessJibaShippingFee(data).due) return false;
  if (isJibaPaymentDeclared(opts.paymentStatus, data)) return false;
  return true;
}

export function nextStateAfterTransfer(opts: {
  instagramHandle?: string | null;
  petRecorded?: boolean;
  licenseAccepted?: boolean;
}): FlowState {
  if (!opts.instagramHandle?.trim()) return FLOW_STATE.ASK_INSTAGRAM;
  if (!opts.petRecorded) return FLOW_STATE.ASK_PET_NAME;
  if (!opts.licenseAccepted) return FLOW_STATE.ASK_CONTENT_LICENSE;
  return FLOW_STATE.SHOW_ORDER_CONFIRMATION;
}

export type JibaApproveDecision =
  | {
      action: 'queue';
      nextAppStatus: typeof APP_STATUS.READY_TO_SHIP;
      nextOrderStatus: 'confirmed';
      shippingQueueStatus: 'QUEUED';
      createShipment: true;
    }
  | {
      action: 'await_payment';
      nextAppStatus: typeof APP_STATUS.AWAITING_SHIPPING_PAYMENT;
      nextOrderStatus: 'awaiting_shipping_payment';
      shippingQueueStatus: 'QUEUED';
      createShipment: true;
    }
  | { action: 'idempotent'; nextAppStatus: AppStatus; createShipment: boolean }
  | { action: 'reject'; reason: string };

export function decideJibaApproveTransition(input: {
  status: string;
  paymentStatus?: string | null;
  collected?: Record<string, unknown> | string | null;
  shippingQueueStatus?: string | null;
}): JibaApproveDecision {
  if (input.status === APP_STATUS.READY_TO_SHIP) {
    return {
      action: 'idempotent',
      nextAppStatus: APP_STATUS.READY_TO_SHIP,
      createShipment: true,
    };
  }
  if (
    input.status === APP_STATUS.AWAITING_SHIPPING_PAYMENT ||
    input.status === APP_STATUS.APPROVED
  ) {
    if (isJibaPaymentSatisfied(input)) {
      return {
        action: 'queue',
        nextAppStatus: APP_STATUS.READY_TO_SHIP,
        nextOrderStatus: 'confirmed',
        shippingQueueStatus: 'QUEUED',
        createShipment: true,
      };
    }
    return {
      action: 'idempotent',
      nextAppStatus: APP_STATUS.AWAITING_SHIPPING_PAYMENT,
      createShipment: true,
    };
  }
  if (input.status !== APP_STATUS.PENDING_REVIEW) {
    return { action: 'reject', reason: `申請狀態不可審核通過：${input.status}` };
  }
  if (isJibaPaymentSatisfied(input)) {
    return {
      action: 'queue',
      nextAppStatus: APP_STATUS.READY_TO_SHIP,
      nextOrderStatus: 'confirmed',
      shippingQueueStatus: 'QUEUED',
      createShipment: true,
    };
  }
  return {
    action: 'await_payment',
    nextAppStatus: APP_STATUS.AWAITING_SHIPPING_PAYMENT,
    nextOrderStatus: 'awaiting_shipping_payment',
    shippingQueueStatus: 'QUEUED',
    createShipment: true,
  };
}

/** 出貨列表可見的訂單狀態：只排除已取消，避免 application／order 不一致漏單 */
export const SHIPMENT_QUEUE_HIDDEN_ORDER_STATUSES = ['cancelled'] as const;

export const JIBA_PAYMENT_REVIEW_ORDER_STATUS = 'awaiting_shipping_payment' as const;
export const JIBA_PAYMENT_REVIEW_LABEL = '等運費核對';

export type JibaShippingChargeKind =
  | 'awaiting_declaration'
  | 'declared'
  | 'paid'
  | 'free_threshold'
  | 'free_waived';

export type JibaShippingChargeDisplay = {
  kind: JibaShippingChargeKind;
  label: string;
  hold: boolean;
};

/** 開箱運費顯示：只有真正免運才寫免運，不把未付／待核帳顯示成包郵 */
export function describeJibaShippingCharge(input: {
  paymentStatus?: string | null;
  collected?: Record<string, unknown> | string | null;
}): JibaShippingChargeDisplay {
  if (input.paymentStatus === PAYMENT_STATUS.WAIVED) {
    return { kind: 'free_waived', label: '免運', hold: false };
  }
  const fee = assessJibaShippingFee(input.collected);
  if (!fee.due) {
    const kind: JibaShippingChargeKind =
      fee.reason === 'waived' ? 'free_waived' : 'free_threshold';
    return {
      kind,
      label: kind === 'free_threshold' ? '加購達門檻｜免運' : '免運',
      hold: false,
    };
  }
  if (input.paymentStatus === PAYMENT_STATUS.PAID) {
    return {
      kind: 'paid',
      label: `物流處理費 ${JIBA_SHIPPING_FEE} 元｜已核帳`,
      hold: false,
    };
  }
  if (isJibaPaymentDeclared(input.paymentStatus, input.collected)) {
    return {
      kind: 'declared',
      label: `物流處理費 ${JIBA_SHIPPING_FEE} 元｜已申報待核帳`,
      hold: true,
    };
  }
  return {
    kind: 'awaiting_declaration',
    label: `物流處理費 ${JIBA_SHIPPING_FEE} 元｜待申報`,
    hold: true,
  };
}

/** 已核准但運費尚未核對／未入帳：列表要看得到，不可當成可立即寄出 */
export function isJibaPaymentReviewHold(order?: {
  status?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  collected?: Record<string, unknown> | string | null;
  isJiba?: boolean;
} | null): boolean {
  if (!order) return false;
  const status = order.orderStatus ?? order.status;
  if (status === JIBA_PAYMENT_REVIEW_ORDER_STATUS) return true;
  if (!order.isJiba) return false;
  return describeJibaShippingCharge(order).hold;
}

export function canMarkJibaShipmentShipped(order?: {
  status?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  collected?: Record<string, unknown> | string | null;
  isJiba?: boolean;
} | null): boolean {
  return !isJibaPaymentReviewHold(order);
}

export function isShipmentQueueVisibleOrderStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  return !SHIPMENT_QUEUE_HIDDEN_ORDER_STATUSES.includes(
    status as (typeof SHIPMENT_QUEUE_HIDDEN_ORDER_STATUSES)[number],
  );
}

export function isJibaBackfillCandidate(input: {
  appStatus: string;
  paymentStatus?: string | null;
  collected?: Record<string, unknown> | string | null;
  hasActiveShipment: boolean;
  orderId?: string | null;
  orderStatus?: string | null;
}): boolean {
  if (input.hasActiveShipment) return false;
  if (!input.orderId) return false;
  if (input.orderStatus === 'cancelled') return false;
  if (
    input.appStatus !== APP_STATUS.APPROVED &&
    input.appStatus !== APP_STATUS.AWAITING_SHIPPING_PAYMENT &&
    input.appStatus !== APP_STATUS.READY_TO_SHIP
  ) {
    return false;
  }
  return true;
}

/** 已核准漏單：付款已滿足才升 READY；未申報只補出貨單、不改成已付 */
export function jibaBackfillRepairKind(input: {
  appStatus: string;
  paymentStatus?: string | null;
  collected?: Record<string, unknown> | string | null;
}): 'queue_ready' | 'await_payment_shipment' {
  if (input.appStatus === APP_STATUS.READY_TO_SHIP) return 'queue_ready';
  if (
    isJibaPaymentSatisfied({
      paymentStatus: input.paymentStatus,
      collected: input.collected,
    })
  ) {
    return 'queue_ready';
  }
  return 'await_payment_shipment';
}
