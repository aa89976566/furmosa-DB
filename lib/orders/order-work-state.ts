export const PAID_FOR_FULFILLMENT = ['paid', 'cod'] as const;
export const PASSIVE_PAYMENT_WAIT = ['unpaid', 'partial'] as const;

export type OrderWorkState = 'ACTION_REQUIRED' | 'WAITING' | 'DONE';

export type OrderWorkInput = {
  omsStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
};

/**
 * Single source of truth for HQ order-task eligibility.
 *
 * Rules:
 * - NEW / REVIEW always require an HQ action, regardless of payment.
 * - READY can wait for external payment only after review has completed.
 * - READY with paid/COD is actionable because fulfillment can continue.
 * - Refunded/unknown payment states stay actionable; they must never disappear into waiting.
 * - FULFILLMENT_PENDING is actionable until handoff is completed.
 * - FULFILLED is done.
 * - Unknown enrolled OMS states fail closed as actionable.
 */
export function getOrderWorkState(input: OrderWorkInput): OrderWorkState {
  const status = input.omsStatus ?? null;
  const payment = input.paymentStatus ?? '';

  if (status === null) return 'DONE';
  if (status === 'NEW' || status === 'REVIEW') return 'ACTION_REQUIRED';
  if (status === 'READY') {
    if ((PASSIVE_PAYMENT_WAIT as readonly string[]).includes(payment)) return 'WAITING';
    return 'ACTION_REQUIRED';
  }
  if (status === 'FULFILLMENT_PENDING') return 'ACTION_REQUIRED';
  if (status === 'FULFILLED') return 'DONE';
  return 'ACTION_REQUIRED';
}

export function isFulfillmentPaymentReady(paymentStatus: string | null | undefined): boolean {
  return (PAID_FOR_FULFILLMENT as readonly string[]).includes(paymentStatus ?? '');
}
