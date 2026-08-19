import {
  ALLOWANCE_LABEL,
  LOW_STOCK_BADGE,
  SOLD_OUT_BADGE,
  SURCHARGE_LABEL,
} from './copy';
import type { StockLevel } from './types';

export function formatTwd(amount: number): string {
  return `NT$${amount.toLocaleString('zh-TW')}`;
}

export function formatQty(qty: number): string {
  return `${qty} 件`;
}

export function stockLevelLabel(level: StockLevel): string | null {
  if (level === 'low') return LOW_STOCK_BADGE;
  if (level === 'sold_out') return SOLD_OUT_BADGE;
  return null;
}

export function allowanceLabel(allowanceTwd: number): string {
  return allowanceTwd < 0 ? SURCHARGE_LABEL : ALLOWANCE_LABEL;
}
