import type { Prisma } from '@prisma/client';
import { parseTaipeiMonth } from '@/lib/taipei-date';

export const SETTLEMENT_STATUSES = ['draft', 'reviewing', 'approved', 'paid'] as const;

export type SettlementListFilters = {
  status?: (typeof SETTLEMENT_STATUSES)[number];
  month?: string;
  merchantId?: string;
};

export function buildSettlementWhere(filters: SettlementListFilters): Prisma.SettlementWhereInput {
  const where: Prisma.SettlementWhereInput = {};

  if (filters.merchantId) where.merchantId = filters.merchantId;
  if (
    filters.status &&
    (SETTLEMENT_STATUSES as readonly string[]).includes(filters.status)
  ) {
    where.status = filters.status;
  }

  if (filters.month) {
    const range = parseTaipeiMonth(filters.month);
    if (range) {
      // 結算期間與該月有交集
      where.periodStart = { lte: range.end };
      where.periodEnd = { gte: range.start };
    }
  }

  return where;
}

export function parseSettlementListSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): SettlementListFilters {
  const pick = (key: string) => {
    const v = searchParams[key];
    return typeof v === 'string' ? v : undefined;
  };

  const status = pick('status');
  return {
    merchantId: pick('merchantId'),
    month: pick('month'),
    status:
      status && (SETTLEMENT_STATUSES as readonly string[]).includes(status)
        ? (status as (typeof SETTLEMENT_STATUSES)[number])
        : undefined,
  };
}
