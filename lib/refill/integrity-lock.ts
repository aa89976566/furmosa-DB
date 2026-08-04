import { Prisma } from '@prisma/client';
import type { RefillOrderStatus } from '@/lib/refill/constants';

/** 顧客端付款白名單欄位（禁止 callbackPayload 等內部資料） */
export type CustomerPaymentView = {
  id: string;
  purpose: string;
  amount: number;
  status: string;
  paidAt: string | null;
  merchantTradeNo: string;
};

export const CUSTOMER_PAYMENT_SELECT = {
  id: true,
  purpose: true,
  amount: true,
  status: true,
  paidAt: true,
  merchantTradeNo: true,
} as const;

export function toCustomerPaymentView(row: {
  id: string;
  purpose: string;
  amount: number;
  status: string;
  paidAt: Date | string | null;
  merchantTradeNo: string;
}): CustomerPaymentView {
  return {
    id: row.id,
    purpose: row.purpose,
    amount: row.amount,
    status: row.status,
    paidAt:
      row.paidAt == null
        ? null
        : typeof row.paidAt === 'string'
          ? row.paidAt
          : row.paidAt.toISOString(),
    merchantTradeNo: row.merchantTradeNo,
  };
}

export function mapCustomerPayments(
  rows: Array<{
    id: string;
    purpose: string;
    amount: number;
    status: string;
    paidAt: Date | string | null;
    merchantTradeNo: string;
  }> | null | undefined,
): CustomerPaymentView[] {
  return (rows ?? []).map(toCustomerPaymentView);
}

/** exchange → old_container_verified；first／topup-as-first → paid_waiting_return */
export function expectedCompleteFromStatus(input: {
  deliveryMode: string;
  orderType: string;
}): RefillOrderStatus {
  const isFirstPath = input.deliveryMode === 'first' || input.orderType === 'first';
  return isFirstPath ? 'paid_waiting_return' : 'old_container_verified';
}

export function isFirstDeliveryPath(input: {
  deliveryMode: string;
  orderType: string;
}): boolean {
  return input.deliveryMode === 'first' || input.orderType === 'first';
}

/**
 * 條件式 updateMany 結果解讀。
 * won === true 才可繼續改罐／加點。
 */
export function interpretClaimCount(count: number): 'won' | 'lost' {
  return count === 1 ? 'won' : 'lost';
}

export type VerifyConflictKind =
  | 'idempotent_same_serial'
  | 'conflict_different_serial'
  | 'invalid_status';

export function classifyVerifyOrderConflict(input: {
  status: string;
  oldContainerSerial: string | null;
  attemptedSerial: string;
}): VerifyConflictKind {
  if (input.status === 'old_container_verified') {
    if (input.oldContainerSerial === input.attemptedSerial) {
      return 'idempotent_same_serial';
    }
    return 'conflict_different_serial';
  }
  return 'invalid_status';
}

export type CompleteConflictKind = 'idempotent_completed' | 'invalid_status';

export function classifyCompleteOrderConflict(status: string): CompleteConflictKind {
  if (status === 'completed') return 'idempotent_completed';
  return 'invalid_status';
}

/** 僅當 unique 撞在 sourceType+sourceRefId 時視為已加點 */
export function isPointsLedgerUniqueConflict(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code !== 'P2002') return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) {
    const fields = target.map((t) => String(t).toLowerCase());
    const joined = fields.join(',');
    if (joined.includes('source_type_source_ref_id')) return true;
    const hasType = fields.some((f) => f === 'source_type' || f === 'sourcetype');
    const hasRef = fields.some((f) => f === 'source_ref_id' || f === 'sourcerefid');
    return hasType && hasRef;
  }
  if (typeof target === 'string') {
    const t = target.toLowerCase();
    return (
      t.includes('source_type_source_ref_id') ||
      (t.includes('source_type') && t.includes('source_ref_id'))
    );
  }
  return false;
}
