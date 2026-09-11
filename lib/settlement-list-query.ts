import type { Prisma } from '@prisma/client';
import { parseTaipeiMonth } from '@/lib/taipei-date';

/** 計入有效財務總計的狀態；`cancelled`（已撤回）不在此列。 */
export const SETTLEMENT_FINANCIAL_STATUSES = [
  'draft',
  'reviewing',
  'approved',
  'paid',
] as const;

export const SETTLEMENT_STATUSES = [
  ...SETTLEMENT_FINANCIAL_STATUSES,
  'cancelled',
] as const;

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

/**
 * 財務總計專用條件：一律排除已撤回。即使使用者正在篩選 `cancelled`，
 * 也不得把撤回金額加回有效總計。
 */
export function buildSettlementFinancialWhere(
  filters: SettlementListFilters
): Prisma.SettlementWhereInput {
  const { status, ...rest } = buildSettlementWhere(filters);
  return {
    ...rest,
    // 用 AND 交集而不是覆蓋 status，篩選 paid 時仍只統計 paid，
    // 篩選 cancelled 時交集為空而不是回頭統計全部狀態。
    AND: [
      { status: { in: [...SETTLEMENT_FINANCIAL_STATUSES] } },
      ...(status == null ? [] : [{ status }]),
    ],
  };
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
