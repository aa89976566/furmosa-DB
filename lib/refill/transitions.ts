import type { RefillOrderStatus } from '@/lib/refill/constants';

/**
 * 允許的狀態轉移。未列出的轉移一律拒絕。
 * 首罐／補差額交付可從 paid_waiting_return 直接 completed（不經舊罐驗證）。
 */
const ALLOWED: Record<RefillOrderStatus, readonly RefillOrderStatus[]> = {
  draft: ['payment_pending', 'paid_waiting_return', 'cancelled', 'expired'],
  payment_pending: [
    'paid_waiting_return',
    'payment_failed',
    'cancelled',
    'expired',
  ],
  payment_failed: ['payment_pending', 'paid_waiting_return', 'cancelled', 'expired'],
  paid_waiting_return: [
    'old_container_verified',
    'awaiting_extra_payment',
    'completed', // first / topup 路徑
    'cancelled', // 僅 HQ／特殊；一般 POS 禁用
    'expired',
  ],
  awaiting_extra_payment: [
    'paid_waiting_return', // 補付成功後回到待交付（first 模式）
    'payment_failed',
    'cancelled',
    'expired',
  ],
  old_container_verified: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  expired: [],
};

export function canTransition(
  from: RefillOrderStatus,
  to: RefillOrderStatus,
): boolean {
  if (from === to) return true;
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertTransition(
  from: RefillOrderStatus,
  to: RefillOrderStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`換罐訂單狀態不可由 ${from} 變更為 ${to}`);
  }
}
