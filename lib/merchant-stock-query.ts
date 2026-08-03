import type { Prisma } from '@prisma/client';
import { parseTaipeiMonth } from '@/lib/taipei-date';

export const MERCHANT_STOCK_TXN_TYPES = [
  'restock',
  'sale',
  'adjust',
  'return',
  'refill_reservation',
  'refill_delivery',
  'refill_release',
] as const;
export type MerchantStockTxnType = (typeof MERCHANT_STOCK_TXN_TYPES)[number];

/** 寄賣月結納入的類型（不含換罐 refill_*） */
export const MERCHANT_SETTLEMENT_SALE_TXN_TYPES = ['sale', 'adjust'] as const;

export type MerchantStockLedgerFilters = {
  merchantId?: string;
  type?: MerchantStockTxnType;
  month?: string;
  settled?: 'all' | 'open' | 'settled';
};

export function buildMerchantStockTxnWhere(
  filters: MerchantStockLedgerFilters
): Prisma.MerchantStockTxnWhereInput {
  const where: Prisma.MerchantStockTxnWhereInput = {};

  if (filters.merchantId) where.merchantId = filters.merchantId;
  if (filters.type && (MERCHANT_STOCK_TXN_TYPES as readonly string[]).includes(filters.type)) {
    where.type = filters.type;
  }
  if (filters.settled === 'open') where.settlementId = null;
  if (filters.settled === 'settled') where.settlementId = { not: null };

  if (filters.month) {
    const range = parseTaipeiMonth(filters.month);
    if (range) {
      where.createdAt = { gte: range.start, lte: range.end };
    }
  }

  return where;
}

export function parseMerchantStockLedgerSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): MerchantStockLedgerFilters {
  const pick = (key: string) => {
    const v = searchParams[key];
    return typeof v === 'string' ? v : undefined;
  };

  const type = pick('type');
  const settled = pick('settled');

  return {
    merchantId: pick('merchantId'),
    type:
      type && (MERCHANT_STOCK_TXN_TYPES as readonly string[]).includes(type)
        ? (type as MerchantStockTxnType)
        : undefined,
    month: pick('month'),
    settled:
      settled === 'open' || settled === 'settled' || settled === 'all' ? settled : undefined,
  };
}
