/** 寄賣店家產業（Merchant.industry） */
export const MERCHANT_INDUSTRIES = [
  'beauty',
  'restaurant',
  'cafe',
  'hypermarket',
] as const;

export type MerchantIndustry = (typeof MERCHANT_INDUSTRIES)[number];

export const merchantIndustryLabel: Record<MerchantIndustry, string> = {
  beauty: '美容',
  restaurant: '餐廳',
  cafe: '咖啡店',
  hypermarket: '量販店',
};

export function parseMerchantIndustry(
  raw: FormDataEntryValue | null | undefined,
): MerchantIndustry | null {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  return MERCHANT_INDUSTRIES.includes(v as MerchantIndustry) ? (v as MerchantIndustry) : null;
}

export function merchantIndustryDisplay(industry: string | null | undefined): string {
  if (!industry) return '—';
  return merchantIndustryLabel[industry as MerchantIndustry] ?? industry;
}
