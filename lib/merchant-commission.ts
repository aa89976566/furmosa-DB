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

/**
 * 依品名／分類推斷寄賣分潤：
 * - 凍乾 → 30%
 * - 其餘（肉乾、零食等）→ 20%
 */
export function suggestMerchantCommissionPercent(product: {
  name: string;
  category?: string | null;
}): MerchantCommissionPercent {
  const name = product.name.trim();
  if (name.includes('凍乾') || product.category === 'freeze_dried') {
    return 30;
  }
  return 20;
}

export function merchantCommissionKindLabel(percent: MerchantCommissionPercent): string {
  return percent === 30 ? '凍乾' : '肉乾／一般零食';
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
