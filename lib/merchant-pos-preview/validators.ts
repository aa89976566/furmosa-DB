import { PRICE_ERROR_EMPTY, PRICE_ERROR_INVALID, QTY_ERROR_INVALID } from './copy';
import type { PriceParseResult } from './types';

const POSITIVE_INT = /^[1-9][0-9]*$/;

function isForbiddenNumericShape(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === '') return true;
  if (trimmed.includes('.') || trimmed.includes(',')) return true;
  if (/[eE]/.test(trimmed)) return true;
  if (/infinity/i.test(trimmed) || /nan/i.test(trimmed)) return true;
  if (trimmed.startsWith('+') || trimmed.startsWith('-')) return true;
  if (trimmed.startsWith('0')) return true;
  return false;
}

export function parsePositiveIntTwd(raw: string): PriceParseResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: PRICE_ERROR_INVALID };
  }
  if (raw.trim() === '') {
    return { ok: false, error: PRICE_ERROR_EMPTY };
  }
  if (isForbiddenNumericShape(raw) || !POSITIVE_INT.test(raw.trim())) {
    return { ok: false, error: PRICE_ERROR_INVALID };
  }
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || !Number.isFinite(value) || value <= 0) {
    return { ok: false, error: PRICE_ERROR_INVALID };
  }
  return { ok: true, value };
}

export function parsePositiveIntQty(raw: string): PriceParseResult {
  const parsed = parsePositiveIntTwd(raw);
  if (!parsed.ok) {
    return { ok: false, error: QTY_ERROR_INVALID };
  }
  return parsed;
}

/** Preview-only local rule. Service total must be strictly greater than face. */
export function serviceTotalExceedsFace(
  serviceTotalTwd: number,
  faceTwd: number,
): boolean {
  return (
    Number.isInteger(serviceTotalTwd) &&
    Number.isInteger(faceTwd) &&
    Number.isFinite(serviceTotalTwd) &&
    Number.isFinite(faceTwd) &&
    serviceTotalTwd > faceTwd
  );
}
