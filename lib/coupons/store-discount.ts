export const GROOMING_COUPON_DISCOUNT_ZHUWO = 250;
export const GROOMING_COUPON_DISCOUNT_DEFAULT = 200;

/** 未綁定店家時的籠統說明（清單不列金額；綁定後由系統偵測對應面額） */
export const GROOMING_COUPON_DISCOUNT_LABEL = '依你綁定的合作門市';

export function isZhuwoPartnerStore(storeId: string, storeName?: string | null): boolean {
  const id = storeId.trim().toLowerCase();
  // zhuwo_* 分店；mer_0016 為舊版單一「豬窩」；mer_0019／mer_0020 為寄賣分店編號對應 slug
  if (
    id.startsWith('zhuwo_') ||
    id === 'mer_0016' ||
    id === 'mer_0019' ||
    id === 'mer_0020'
  ) {
    return true;
  }
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

/** 單一店家的折價說明，例：豬窩 中和店 · 250 元（綁定後／確認用） */
export function formatGroomingCouponDiscountForStore(
  storeId: string,
  storeName?: string | null,
): string {
  const amount = getGroomingCouponDiscountForStore(storeId, storeName);
  const label = storeName?.trim() || storeId;
  return `${label} · ${formatGroomingCouponDiscountAmount(amount)}`;
}

/**
 * LINE 店家清單／選店按鈕：只顯示店名，不露出折價金額。
 * 金額改在開戶綁定後，依系統偵測門市再通知。
 */
export function formatLineStorePickerLabel(name: string, _slug?: string): string {
  return name.trim();
}

/** 開戶綁定後：提醒傳序號累點，並告知該門市可折金額 */
export function buildPostBindPointsHint(opts: {
  storeId: string;
  storeName?: string | null;
  pointsToRedeem?: number;
}): string {
  const points = opts.pointsToRedeem ?? 10;
  const amount = getGroomingCouponDiscountForStore(opts.storeId, opts.storeName);
  const store = opts.storeName?.trim() || '你綁定的合作門市';
  return [
    `罐底那串 8 碼傳上來，就能幫毛孩累積點數喔～`,
    `存滿 ${points} 點，在「${store}」洗澡美容可折 ${amount} 元（依你綁定的門市）。`,
  ].join('\n');
}
