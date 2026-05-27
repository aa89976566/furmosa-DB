/** 寄賣店家類型（可複選，存於 Merchant.types；Merchant.type 為主要類型） */
export const MERCHANT_TYPES = [
  'consignment',
  'pop_up',
  'flagship',
  'partner',
  'jar_exchange',
] as const;

export type MerchantType = (typeof MERCHANT_TYPES)[number];

export const merchantTypeLabel: Record<MerchantType, string> = {
  consignment: '寄賣',
  pop_up: '快閃',
  flagship: '旗艦',
  partner: '合作夥伴',
  jar_exchange: '換罐',
};

export function isMerchantType(value: string): value is MerchantType {
  return MERCHANT_TYPES.includes(value as MerchantType);
}

export function parseMerchantTypesFromForm(formData: FormData): MerchantType[] {
  const raw = formData.getAll('types').map((v) => String(v).trim()).filter(Boolean);
  const valid = raw.filter(isMerchantType);
  return [...new Set(valid)];
}

/** 主要類型（寫入 legacy `type` 欄，取複選第一項） */
export function primaryMerchantType(types: MerchantType[]): MerchantType {
  return types[0] ?? 'consignment';
}

export function resolveMerchantTypes(merchant: {
  type: string;
  types?: string[] | null;
}): MerchantType[] {
  if (merchant.types?.length) {
    const valid = merchant.types.filter(isMerchantType);
    if (valid.length) return valid;
  }
  if (isMerchantType(merchant.type)) return [merchant.type];
  return ['consignment'];
}

export function merchantTypeDisplay(types: MerchantType[]): string {
  if (!types.length) return '—';
  return types.map((t) => merchantTypeLabel[t]).join('、');
}
