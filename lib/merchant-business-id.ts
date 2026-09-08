export function nextMerchantBusinessId(ids: string[]): string {
  const max = ids.reduce((current, id) => {
    const match = /^MER-(\d+)$/.exec(id.trim());
    if (!match) return current;
    const value = Number(match[1]);
    return Number.isSafeInteger(value) ? Math.max(current, value) : current;
  }, 0);

  return `MER-${String(max + 1).padStart(4, '0')}`;
}

/** 正式店家編號：MER- 加上至少四位數字。 */
export function isValidMerchantBusinessId(id: string): boolean {
  return /^MER-\d{4,}$/.test(id.trim());
}

/** 測試／示範／對照編號，不得當成正式店家、也不可「修復」成正式號。 */
export const RESERVED_NON_OFFICIAL_MERCHANT_IDS = new Set([
  'MER-DEMO',
  'MER-REFILL',
  'MER-OTHER',
]);

export function isReservedNonOfficialMerchantBusinessId(id: string): boolean {
  const value = id.trim().toUpperCase();
  if (RESERVED_NON_OFFICIAL_MERCHANT_IDS.has(value)) return true;
  return /^MER-[A-Z]+$/.test(value);
}

export type MerchantBusinessIdKind = 'official' | 'reserved' | 'invalid';

export function merchantBusinessIdKind(id: string): MerchantBusinessIdKind {
  if (isValidMerchantBusinessId(id)) return 'official';
  if (isReservedNonOfficialMerchantBusinessId(id)) return 'reserved';
  return 'invalid';
}

export function canRepairMerchantBusinessId(id: string): boolean {
  return merchantBusinessIdKind(id) === 'invalid';
}
