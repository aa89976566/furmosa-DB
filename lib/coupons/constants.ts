export const COUPON_STATUSES = ['available', 'redeemed', 'expired'] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

/** @deprecated 請改用 getGroomingCouponTypeForDiscount；豬窩為 grooming_250、其他為 grooming_200 */
export const GROOMING_COUPON_TYPE = 'grooming_250';
export const GROOMING_COUPON_POINTS = 10;
/** @deprecated 請改用 getGroomingCouponDiscountForStore；豬窩 250、其他 200 */
export const GROOMING_COUPON_DISCOUNT = 250;
export const GROOMING_COUPON_VALIDITY_DAYS = 30;
export const FURMOSA_COUPON_PREFIX = 'FURMOSA-';
export const FURMOSA_COUPON_DIGIT_LENGTH = 4;

export {
  GROOMING_COUPON_DISCOUNT_DEFAULT,
  GROOMING_COUPON_DISCOUNT_LABEL,
  GROOMING_COUPON_DISCOUNT_ZHUWO,
  getGroomingCouponDiscountForStore,
  getGroomingCouponTypeForDiscount,
  isZhuwoPartnerStore,
  formatGroomingCouponDiscountAmount,
  formatGroomingCouponDiscountForStore,
  formatLineStorePickerLabel,
} from '@/lib/coupons/store-discount';
