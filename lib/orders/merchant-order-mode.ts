import type { MerchantType } from '@/lib/merchant-types';

export const MERCHANT_ORDER_MODES = [
  'consignment',
  'wholesale',
  'jar_exchange',
] as const;

export type MerchantOrderMode = (typeof MERCHANT_ORDER_MODES)[number];

export const merchantOrderModeLabel: Record<MerchantOrderMode, string> = {
  consignment: '寄賣',
  wholesale: '販售',
  jar_exchange: '換罐計畫',
};

export const merchantOrderModeDescription: Record<MerchantOrderMode, string> = {
  consignment: '先補貨，售出後再對帳',
  wholesale: '店家買斷，建立後計入銷售',
  jar_exchange: '只補換罐商品，不在此計算顧客金額',
};

export function isMerchantOrderMode(value: string): value is MerchantOrderMode {
  return (MERCHANT_ORDER_MODES as readonly string[]).includes(value);
}

export function merchantOrderModesForTypes(types: MerchantType[]): MerchantOrderMode[] {
  return MERCHANT_ORDER_MODES.filter((mode) => types.includes(mode));
}

export function merchantOrderSource(mode: MerchantOrderMode): string {
  return mode === 'wholesale' ? 'wholesale' : 'consignment';
}

export function merchantOrderProductCategory(mode: MerchantOrderMode): 'STANDARD' | 'JAR_EXCHANGE' {
  return mode === 'jar_exchange' ? 'JAR_EXCHANGE' : 'STANDARD';
}
