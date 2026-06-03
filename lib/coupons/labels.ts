import type { CouponStatus } from '@/lib/coupons/constants';

export const couponStatusLabel: Record<CouponStatus, string> = {
  available: '未使用',
  redeemed: '已使用',
  expired: '已過期',
};

export function formatCouponStatus(status: CouponStatus): string {
  return couponStatusLabel[status] ?? status;
}
