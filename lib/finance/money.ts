/** 既有訂單金額是元（Float）。財務新欄位用整數分。缺值維持 null，不用 0 代替。 */
export function dollarsToCents(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function centsToInputValue(cents: number | null | undefined): string {
  if (cents == null) return '';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  if (fraction === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${String(fraction).padStart(2, '0')}`;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString('zh-TW');
  const fraction = abs % 100;
  if (fraction === 0) return `${sign}NT$${whole}`;
  return `${sign}NT$${whole}.${String(fraction).padStart(2, '0')}`;
}

export function formatRateBps(bps: number): string {
  const sign = bps < 0 ? '-' : '';
  const abs = Math.abs(bps);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  if (fraction === 0) return `${sign}${whole}%`;
  return `${sign}${whole}.${String(fraction).padStart(2, '0')}`;
}

/** 整數分的比例，四捨五入到 1 個基點（0.01%）。分母為 0 時沒有比率。 */
export function rateBps(numeratorCents: number, denominatorCents: number): number | null {
  if (denominatorCents === 0) return null;
  const numerator = numeratorCents * 10000;
  const sign = numerator < 0 !== denominatorCents < 0 ? -1 : 1;
  const absNum = Math.abs(numerator);
  const absDen = Math.abs(denominatorCents);
  return sign * Math.floor((absNum + Math.floor(absDen / 2)) / absDen);
}

export function divideCents(totalCents: number, quantity: number): number | null {
  if (!Number.isInteger(quantity) || quantity <= 0) return null;
  return rateScale(totalCents, quantity);
}

function rateScale(numerator: number, denominator: number): number {
  const sign = numerator < 0 ? -1 : 1;
  const absNum = Math.abs(numerator);
  return sign * Math.floor((absNum + Math.floor(denominator / 2)) / denominator);
}
