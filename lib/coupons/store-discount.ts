export const GROOMING_COUPON_DISCOUNT_ZHUWO = 250;
export const GROOMING_COUPON_DISCOUNT_DEFAULT = 200;

/** 折價券面額說明（LINE / 後台文案） */
export const GROOMING_COUPON_DISCOUNT_LABEL = '200 或 250 元（依店家）';

export function isZhuwoPartnerStore(storeId: string, storeName?: string | null): boolean {
  const id = storeId.trim().toLowerCase();
  if (id.startsWith('zhuwo_') || id === 'mer_0016') return true;
  if (storeName?.includes('豬窩')) return true;
  return false;
}

export function getGroomingCouponDiscountForStore(
  storeId: string,
  storeName?: string | null,
): number {
  return isZhuwoPartnerStore(storeId, storeName)
    ? GROOMING_COUPON_DISCOUNT_ZHUWO
    : GROOMING_COUPON_DISCOUNT_DEFAULT;
}

export function getGroomingCouponTypeForDiscount(amount: number): string {
  return `grooming_${amount}`;
}
