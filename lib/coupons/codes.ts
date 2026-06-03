import { prisma } from '@/lib/prisma';
import {
  FURMOSA_COUPON_DIGIT_LENGTH,
  FURMOSA_COUPON_PREFIX,
} from '@/lib/coupons/constants';

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidFurmosaCouponFormat(code: string): boolean {
  const n = normalizeCouponCode(code);
  return new RegExp(`^${FURMOSA_COUPON_PREFIX}\\d{${FURMOSA_COUPON_DIGIT_LENGTH}}$`).test(n);
}

export function generateFurmosaCouponCode(): string {
  const max = 10 ** FURMOSA_COUPON_DIGIT_LENGTH;
  const n = Math.floor(Math.random() * max);
  return `${FURMOSA_COUPON_PREFIX}${String(n).padStart(FURMOSA_COUPON_DIGIT_LENGTH, '0')}`;
}

export async function generateUniqueFurmosaCouponCode(): Promise<string> {
  for (let attempt = 0; attempt < 80; attempt++) {
    const code = generateFurmosaCouponCode();
    const exists = await prisma.groomingCoupon.findUnique({
      where: { couponCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error('無法產生唯一優惠碼');
}
