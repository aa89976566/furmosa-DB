export const COUPON_STATUSES = ['available', 'redeemed', 'expired'] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

export const GROOMING_COUPON_TYPE = 'grooming_250';
export const GROOMING_COUPON_POINTS = 10;
export const GROOMING_COUPON_DISCOUNT = 250;
export const GROOMING_COUPON_VALIDITY_DAYS = 30;
export const FURMOSA_COUPON_PREFIX = 'FURMOSA-';
export const FURMOSA_COUPON_DIGIT_LENGTH = 4;
