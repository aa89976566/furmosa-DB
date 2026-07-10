export const GROOMING_COUPON_DISCOUNT_ZHUWO = 250;
export const GROOMING_COUPON_DISCOUNT_DEFAULT = 200;

/** 折價券面額說明（未指定店家時） */
export const GROOMING_COUPON_DISCOUNT_LABEL = '豬窩 250 元、其他合作店 200 元';

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

export function formatGroomingCouponDiscountAmount(amount: number): string {
  return `${amount} 元`;
}

/** 單一店家的折價說明，例：豬窩 中和店 · 250 元 */
export function formatGroomingCouponDiscountForStore(
  storeId: string,
  storeName?: string | null,
): string {
  const amount = getGroomingCouponDiscountForStore(storeId, storeName);
  const label = storeName?.trim() || storeId;
  return `${label} · ${formatGroomingCouponDiscountAmount(amount)}`;
}

/** LINE 開戶選單按鈕文案，例：柒沐寵物美容（200元） */
export function formatLineStorePickerLabel(name: string, slug: string): string {
  const amount = getGroomingCouponDiscountForStore(slug, name);
  return `${name}（${amount}元）`;
}
