import {
  PRICE_ERROR_EMPTY,
  PRICE_ERROR_INVALID,
  QTY_ERROR_INVALID,
  qtyOverStockError,
  qtyRangeHint,
} from './copy';
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

export function parseCartQtyInput(raw: string, maxQty: number): PriceParseResult {
  if (!Number.isInteger(maxQty) || maxQty <= 0) {
    return { ok: false, error: qtyRangeHint(1) };
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: qtyRangeHint(maxQty) };
  }
  const parsed = parsePositiveIntQty(raw);
  if (!parsed.ok) {
    return { ok: false, error: qtyRangeHint(maxQty) };
  }
  if (parsed.value > maxQty) {
    return { ok: false, error: qtyOverStockError(maxQty) };
  }
  return parsed;
}
