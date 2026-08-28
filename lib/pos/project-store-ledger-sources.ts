/**
 * 把已查到的 POS 補貼來源轉成 ledger fact。
 * 在載入階段正規化店家身分與 reward identity；不讀寫資料庫。
 */

import {
  classifyCouponSubsidy,
  classifyRewardRedemption,
  type LedgerEntry,
} from '@/lib/pos/store-ledger';

export type StoreLedgerMerchantContext = {
  id: string;
  merchantId: string;
  name: string;
};

export type StoreLedgerStoreContext = {
  id: string | null;
  slug: string;
};

export type GroomingCouponSourceRow = {
  id: string;
  couponCode: string;
  discountAmount: number;
  redeemedAt: Date | null;
  customerId: string;
  storeId: string;
  storeName: string;
  customer: { id: string; name: string };
};

export type RewardRedemptionSourceRow = {
  id: string;
  couponCode: string | null;
  usedAt: Date | null;
  customerId: string;
  partnerMerchantId?: string | null;
  customer: { id: string; name: string };
  reward: { couponFaceValue: number };
};

function sameText(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && left === right);
}

export function couponRowBelongsToMerchant(
  coupon: Pick<GroomingCouponSourceRow, 'storeId' | 'storeName'>,
  merchant: StoreLedgerMerchantContext,
  store: StoreLedgerStoreContext,
): boolean {
  const storeId = coupon.storeId.trim();
  if (
    sameText(storeId, merchant.id) ||
    sameText(storeId, merchant.merchantId) ||
    sameText(storeId, store.id) ||
    sameText(storeId, store.slug)
  ) {
    return true;
  }
  return sameText(coupon.storeName.trim(), merchant.name);
}

export function redemptionRowBelongsToMerchant(
  redemption: Pick<RewardRedemptionSourceRow, 'partnerMerchantId'>,
  merchant: StoreLedgerMerchantContext,
): boolean {
  if (redemption.partnerMerchantId == null) return true;
  return redemption.partnerMerchantId === merchant.id;
}

/**
 * 將 GroomingCoupon / RewardRedemption 轉成 ledger。
 * storeId 一律寫入伺服器查得的 Merchant.id。
 * 同一 couponCode 的重複投影只保留 GroomingCoupon。
 */
export function projectSubsidyFactsToLedgerEntries(input: {
  merchant: StoreLedgerMerchantContext;
  store: StoreLedgerStoreContext;
  coupons: readonly GroomingCouponSourceRow[];
  redemptions: readonly RewardRedemptionSourceRow[];
}): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const couponCodes = new Set<string>();

  for (const coupon of input.coupons) {
    if (!coupon.redeemedAt) continue;
    if (!couponRowBelongsToMerchant(coupon, input.merchant, input.store)) continue;
    couponCodes.add(coupon.couponCode.toLowerCase());
    entries.push(
      classifyCouponSubsidy({
        id: coupon.id,
        customerId: coupon.customerId,
        customerName: coupon.customer.name,
        couponId: coupon.id,
        couponCode: coupon.couponCode,
        discountAmount: coupon.discountAmount,
        relatedRefillOrderId: null,
        relatedRefillDisplay: null,
        storeId: input.merchant.id,
        redeemedAt: coupon.redeemedAt,
      }),
    );
  }

  for (const redemption of input.redemptions) {
    if (!redemption.usedAt) continue;
    if (!redemptionRowBelongsToMerchant(redemption, input.merchant)) continue;
    const code = (redemption.couponCode ?? '').toLowerCase();
    if (code && couponCodes.has(code)) continue;
    entries.push(
      classifyRewardRedemption({
        id: redemption.id,
        customerId: redemption.customerId,
        customerName: redemption.customer.name,
        couponCode: redemption.couponCode,
        discountAmount: redemption.reward.couponFaceValue,
        storeId: input.merchant.id,
        usedAt: redemption.usedAt,
      }),
    );
  }

  return entries;
}
