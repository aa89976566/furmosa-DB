/**
 * 把已查到的 POS 補貼來源轉成 ledger fact。
 * 在載入階段正規化店家身分與 reward identity；不讀寫資料庫。
 *
 * GroomingCoupon 店家歸屬只認伺服器查得的唯一識別，不靠店名。
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

export const GROOMING_COUPON_SCOPE_RESOLUTIONS = ['owned', 'foreign', 'unresolved'] as const;
export type GroomingCouponScopeResolution = (typeof GROOMING_COUPON_SCOPE_RESOLUTIONS)[number];

function uniqueNonEmptyIds(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of values) {
    const id = typeof value === 'string' ? value.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** 伺服器查得、可安全拿來比對 GroomingCoupon.storeId 的唯一識別。不含店名。 */
export function authoritativeGroomingCouponStoreIds(
  merchant: StoreLedgerMerchantContext,
  store: StoreLedgerStoreContext,
): string[] {
  return uniqueNonEmptyIds([merchant.id, merchant.merchantId, store.id, store.slug]);
}

/**
 * 只依 legacy storeId 與目前 merchant 的唯一識別判斷歸屬。
 * storeName 即使同名也不得納入。
 */
export function resolveGroomingCouponMerchantScope(
  coupon: Pick<GroomingCouponSourceRow, 'storeId' | 'storeName'>,
  merchant: StoreLedgerMerchantContext,
  store: StoreLedgerStoreContext,
): GroomingCouponScopeResolution {
  void coupon.storeName;
  const storeId = typeof coupon.storeId === 'string' ? coupon.storeId.trim() : '';
  if (!storeId) return 'unresolved';
  const aliases = authoritativeGroomingCouponStoreIds(merchant, store);
  if (aliases.length === 0) return 'unresolved';
  if (aliases.includes(storeId)) return 'owned';
  return 'foreign';
}

export function couponRowBelongsToMerchant(
  coupon: Pick<GroomingCouponSourceRow, 'storeId' | 'storeName'>,
  merchant: StoreLedgerMerchantContext,
  store: StoreLedgerStoreContext,
): boolean {
  return resolveGroomingCouponMerchantScope(coupon, merchant, store) === 'owned';
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
