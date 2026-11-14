/** Shared integer-cent parser; safe for browser previews and server validation. */
export function moneyToCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, frac = ''] = value.split('.');
  try {
    const cents = BigInt(whole) * 100n + BigInt((frac + '00').slice(0, 2));
    if (cents < 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    const n = Number(cents);
    return Number.isSafeInteger(n) ? n : null;
  } catch { return null; }
}

