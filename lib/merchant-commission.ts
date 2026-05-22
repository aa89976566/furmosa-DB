/** 寄賣商品分潤：僅支援百分比 20% 或 30% */
export const MERCHANT_COMMISSION_PERCENTS = [20, 30] as const;

export type MerchantCommissionPercent = (typeof MERCHANT_COMMISSION_PERCENTS)[number];

export function isMerchantCommissionPercent(
  value: number,
): value is MerchantCommissionPercent {
  return MERCHANT_COMMISSION_PERCENTS.includes(value as MerchantCommissionPercent);
}

export function parseMerchantCommissionPercent(formData: FormData): MerchantCommissionPercent {
  const raw = Number(formData.get('commissionPercent'));
  if (!isMerchantCommissionPercent(raw)) {
    throw new Error('請選擇寄賣分潤 20% 或 30%');
  }
  return raw;
}

/** 商品列表顯示用 */
export function formatConsignmentCommission(
  mode: string | null | undefined,
  value: number | null | undefined,
): string | null {
  if (mode === 'percent' && value != null) {
    return `${value}%`;
  }
  return null;
}
