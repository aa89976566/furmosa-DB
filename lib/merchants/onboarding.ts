import {
  MERCHANT_COOPERATION_TYPES,
  isMerchantType,
  type MerchantType,
} from '@/lib/merchant-types';

export type MerchantSearchItem = {
  id: string;
  merchantId: string;
  name: string;
  phone: string | null;
  city: string | null;
  types: MerchantType[];
  hasPosAccount: boolean;
};

export function normalizeMerchantName(value: string): string {
  return value.trim().toLocaleLowerCase('zh-Hant').replace(/[\s\u3000]+/g, '');
}

export function normalizePhone(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function mergeMerchantTypes(
  current: readonly string[],
  selected: readonly string[],
): MerchantType[] {
  const valid = [...current, ...selected].filter(isMerchantType);
  return [...new Set(valid)];
}

export function selectedCooperationTypes(values: readonly string[]): MerchantType[] {
  const allowed = new Set<string>(MERCHANT_COOPERATION_TYPES);
  return [...new Set(values.filter((value) => allowed.has(value)))].filter(isMerchantType);
}

export function isLikelyDuplicateMerchant(
  input: { name: string; phone?: string | null },
  existing: { name: string; phone?: string | null },
): boolean {
  const sameName = normalizeMerchantName(input.name) === normalizeMerchantName(existing.name);
  const inputPhone = normalizePhone(input.phone);
  const existingPhone = normalizePhone(existing.phone);
  return sameName || Boolean(inputPhone && existingPhone && inputPhone === existingPhone);
}
