export const MERCHANT_COMMERCIAL_MODES = [
  'consignment',
  'wholesale',
  'jar_exchange',
] as const;

export type MerchantCommercialMode = (typeof MERCHANT_COMMERCIAL_MODES)[number];

export const merchantCommercialModeLabel: Record<MerchantCommercialMode, string> = {
  consignment: '寄賣',
  wholesale: '買斷',
  jar_exchange: '換罐計畫',
};

export type MerchantCommercialPeriod = {
  effectiveFrom: Date;
  effectiveUntil: Date | null;
};

export function parseMerchantCommercialMode(value: FormDataEntryValue | null) {
  const mode = String(value ?? '');
  if (!MERCHANT_COMMERCIAL_MODES.includes(mode as MerchantCommercialMode)) {
    throw new Error('合作模組不正確');
  }
  return mode as MerchantCommercialMode;
}

function parseDateOnly(value: FormDataEntryValue | null, label: string, endOfDay = false) {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`請填寫${label}`);
  const date = new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+08:00`);
  if (Number.isNaN(date.getTime()) || formatMerchantCommercialDate(date) !== raw) {
    throw new Error(`${label}不是有效日期`);
  }
  return date;
}

export function parseMerchantCommercialPeriod(formData: FormData): MerchantCommercialPeriod {
  const effectiveFrom = parseDateOnly(formData.get('effectiveFrom'), '生效日');
  const rawUntil = String(formData.get('effectiveUntil') ?? '').trim();
  const effectiveUntil = rawUntil
    ? parseDateOnly(formData.get('effectiveUntil'), '停用日', true)
    : null;

  if (effectiveUntil && effectiveUntil < effectiveFrom) {
    throw new Error('停用日不可早於生效日');
  }
  return { effectiveFrom, effectiveUntil };
}

export function merchantCommercialPeriodsOverlap(
  left: MerchantCommercialPeriod,
  right: MerchantCommercialPeriod,
) {
  const leftEnd = left.effectiveUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.effectiveUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  return left.effectiveFrom.getTime() <= rightEnd && right.effectiveFrom.getTime() <= leftEnd;
}

export function merchantCommercialPeriodStatus(
  period: MerchantCommercialPeriod,
  now = new Date(),
): 'upcoming' | 'active' | 'ended' {
  if (period.effectiveFrom > now) return 'upcoming';
  if (period.effectiveUntil && period.effectiveUntil < now) return 'ended';
  return 'active';
}

export function validateMerchantCommercialPeriodWrite(
  next: MerchantCommercialPeriod,
  existing: MerchantCommercialPeriod | null,
  now = new Date(),
) {
  const today = new Date(`${formatMerchantCommercialDate(now)}T00:00:00.000+08:00`);
  if (!existing && next.effectiveFrom < today) {
    throw new Error('新合作期間不可從過去日期開始');
  }
  if (existing && merchantCommercialPeriodStatus(existing, now) === 'ended') {
    throw new Error('已結束的合作期間不可修改，請建立新期間');
  }
  if (
    existing &&
    existing.effectiveFrom <= now &&
    existing.effectiveFrom.getTime() !== next.effectiveFrom.getTime()
  ) {
    throw new Error('已生效期間的生效日不可修改');
  }
  if (next.effectiveUntil && next.effectiveUntil < today) {
    throw new Error('不可把停用日回填到過去');
  }
}

export function formatMerchantCommercialDate(date: Date | null) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
