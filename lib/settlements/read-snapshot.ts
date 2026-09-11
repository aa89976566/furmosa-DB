/**
 * 結算讀取路徑：新版身份判定、快照讀取與漂移不變條件。
 *
 * 凍結規格見 docs/reviews/pos-settlement-v1.md。核心不變條件：
 * - 新版身份只看 rulesVersion，絕不以「有沒有明細列」推測。
 * - 新版結算一律讀已存快照，不重算，也不呼叫 calcSettlement。
 * - 舊版（rulesVersion 為 null）維持原路徑，本模組不介入。
 * - 完整性不符時給出可讀訊息，不得靜默顯示看似正確的數字。
 * - cancelled 不計入有效財務總計。
 *
 * Prisma client 由呼叫端注入（型別為 type-only import），模組本身不建立連線，
 * 因此純邏輯部分可以在沒有資料庫的環境單元測試。
 */

import type { PrismaClient } from '@prisma/client';
import {
  LEGACY_FLOAT_TOLERANCE,
  POS_SETTLEMENT_RULES_VERSION,
  halfAwayFromZero,
  withinLegacyTolerance,
  type SettlementSourceDirection,
  type SettlementSourceKind,
} from '@/lib/settlements/source-snapshot';

export const SETTLEMENT_SNAPSHOT_BROKEN_ERROR =
  '這張結帳單的來源明細和總額對不起來，為了避免看到錯誤金額已經停止顯示。請聯絡總部檢查，資料沒有被改動。';

export const SETTLEMENT_SNAPSHOT_EMPTY_ERROR =
  '這張結帳單標記為新版結算，但找不到來源明細。請聯絡總部檢查，資料沒有被改動。';

/** 不計入有效財務總計的狀態。cancelled 是撤回後的稽核殘留。 */
export const SETTLEMENT_EXCLUDED_STATUSES = ['cancelled'] as const;

/**
 * 新版身份判定的唯一依據。
 *
 * 刻意不接受「有明細列就算新版」：撤回後明細會被標記 voidedAt 但不刪除，
 * 而舊版結算永遠沒有 rulesVersion，兩者不能靠列數區分。
 */
export function isPosSettlementVersion(rulesVersion: string | null | undefined): boolean {
  return rulesVersion === POS_SETTLEMENT_RULES_VERSION;
}

/** 任何非 null 的 rulesVersion 都代表存在快照，即使版本號不是本次這一版。 */
export function hasSourceSnapshot(rulesVersion: string | null | undefined): boolean {
  return rulesVersion != null && rulesVersion.length > 0;
}

export type SettlementSourceRow = {
  id: string;
  sourceKind: string;
  sourceKey: string;
  direction: string;
  originalAmount: number;
  quantity: number | null;
  unitPrice: number | null;
  commissionAmount: number | null;
  companyRevenue: number | null;
  occurredAt: Date;
  relatedOrderId: string | null;
  voidedAt: Date | null;
};

export type SettlementHeaderRow = {
  id: string;
  settlementId: string;
  status: string;
  rulesVersion: string | null;
  intendedPaymentMethod: string | null;
  netPayableTwd: number | null;
  storeCollected: number | null;
  grossSales: number;
  commissionAmount: number;
  rewardPayout: number;
  shippingFee: number;
  merchantOwesUs: number;
  payable: number;
  periodStart: Date;
  periodEnd: Date;
  paidAt: Date | null;
  note: string | null;
};

export type SettlementSnapshotView = {
  header: SettlementHeaderRow;
  /** 未作廢的來源，是金額的依據。 */
  activeSources: SettlementSourceRow[];
  /** 已撤回的稽核殘留，只顯示不計入金額。 */
  voidedSources: SettlementSourceRow[];
  netPayableTwd: number;
  direction: SettlementSourceDirection | 'NONE';
  countsTowardValidTotals: boolean;
};

export type SettlementSnapshotResult =
  | { ok: true; view: SettlementSnapshotView }
  | { ok: false; error: string };

function sumFloat(rows: readonly SettlementSourceRow[], pick: (row: SettlementSourceRow) => number) {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function isKind(row: SettlementSourceRow, kind: SettlementSourceKind): boolean {
  return row.sourceKind === kind;
}

/**
 * 漂移不變條件。
 *
 * legacy Float 合計只允許 0.01 的比較容差（浮點加總誤差）；
 * 已存的整數淨額必須與明細重算完全相等，不得套用任何容差。
 */
export function verifySnapshotIntegrity(
  header: SettlementHeaderRow,
  activeSources: readonly SettlementSourceRow[],
): { ok: true } | { ok: false; error: string } {
  if (activeSources.length === 0) {
    // 全部撤回時淨額必須是 0，否則 header 與明細已經失去一致性。
    if (header.netPayableTwd != null && header.netPayableTwd !== 0) {
      return { ok: false, error: SETTLEMENT_SNAPSHOT_BROKEN_ERROR };
    }
    return { ok: true };
  }

  const gross = sumFloat(activeSources, (row) =>
    isKind(row, 'consignment_sale') ? row.originalAmount : 0,
  );
  const commission = sumFloat(activeSources, (row) =>
    isKind(row, 'consignment_sale') ? row.commissionAmount ?? 0 : 0,
  );
  const reward = sumFloat(activeSources, (row) =>
    isKind(row, 'coupon_subsidy') ? row.originalAmount : 0,
  );
  const collected = sumFloat(activeSources, (row) =>
    isKind(row, 'store_collection') ? row.originalAmount : 0,
  );

  if (
    !withinLegacyTolerance(header.grossSales, gross) ||
    !withinLegacyTolerance(header.commissionAmount, commission) ||
    !withinLegacyTolerance(header.rewardPayout, reward)
  ) {
    return { ok: false, error: SETTLEMENT_SNAPSHOT_BROKEN_ERROR };
  }

  const merchantOwesUs = gross - commission - reward - header.shippingFee + collected;
  if (!withinLegacyTolerance(header.merchantOwesUs, merchantOwesUs)) {
    return { ok: false, error: SETTLEMENT_SNAPSHOT_BROKEN_ERROR };
  }

  // 整數淨額不套容差。
  if (header.netPayableTwd != null && header.netPayableTwd !== halfAwayFromZero(merchantOwesUs)) {
    return { ok: false, error: SETTLEMENT_SNAPSHOT_BROKEN_ERROR };
  }

  return { ok: true };
}

export function buildSnapshotView(
  header: SettlementHeaderRow,
  sources: readonly SettlementSourceRow[],
): SettlementSnapshotResult {
  if (!hasSourceSnapshot(header.rulesVersion)) {
    return { ok: false, error: SETTLEMENT_SNAPSHOT_EMPTY_ERROR };
  }

  const activeSources = sources.filter((row) => row.voidedAt == null);
  const voidedSources = sources.filter((row) => row.voidedAt != null);

  if (sources.length === 0) {
    return { ok: false, error: SETTLEMENT_SNAPSHOT_EMPTY_ERROR };
  }

  const integrity = verifySnapshotIntegrity(header, activeSources);
  if (!integrity.ok) return integrity;

  const netPayableTwd = header.netPayableTwd ?? 0;

  return {
    ok: true,
    view: {
      header,
      activeSources,
      voidedSources,
      netPayableTwd,
      direction:
        netPayableTwd > 0 ? 'STORE_TO_FURMOSA' : netPayableTwd < 0 ? 'FURMOSA_TO_STORE' : 'NONE',
      countsTowardValidTotals: countsTowardValidTotals(header.status),
    },
  };
}

export function countsTowardValidTotals(status: string): boolean {
  return !SETTLEMENT_EXCLUDED_STATUSES.includes(status as (typeof SETTLEMENT_EXCLUDED_STATUSES)[number]);
}

const HEADER_SELECT = {
  id: true,
  settlementId: true,
  status: true,
  rulesVersion: true,
  intendedPaymentMethod: true,
  netPayableTwd: true,
  storeCollected: true,
  grossSales: true,
  commissionAmount: true,
  rewardPayout: true,
  shippingFee: true,
  merchantOwesUs: true,
  payable: true,
  periodStart: true,
  periodEnd: true,
  paidAt: true,
  note: true,
} as const;

const SOURCE_SELECT = {
  id: true,
  sourceKind: true,
  sourceKey: true,
  direction: true,
  originalAmount: true,
  quantity: true,
  unitPrice: true,
  commissionAmount: true,
  companyRevenue: true,
  occurredAt: true,
  relatedOrderId: true,
  voidedAt: true,
} as const;

/**
 * 讀取新版結算快照。
 *
 * 呼叫端必須先以 rulesVersion 判定新版才走這裡；舊版請維持原本的 calcSettlement 路徑。
 * 缺表環境回傳可讀錯誤而不是假裝成功。
 */
export async function loadSettlementSnapshot(
  client: PrismaClient,
  settlementRowId: string,
): Promise<SettlementSnapshotResult> {
  try {
    const header = await client.settlement.findUnique({
      where: { id: settlementRowId },
      select: HEADER_SELECT,
    });
    if (!header) return { ok: false, error: SETTLEMENT_SNAPSHOT_EMPTY_ERROR };

    const sources = await client.settlementSourceItem.findMany({
      where: { settlementId: settlementRowId },
      select: SOURCE_SELECT,
      orderBy: [{ occurredAt: 'asc' }, { sourceKey: 'asc' }],
    });

    return buildSnapshotView(header, sources);
  } catch (error) {
    if (isMissingSchemaRead(error)) {
      return { ok: false, error: SETTLEMENT_SNAPSHOT_BROKEN_ERROR };
    }
    throw error;
  }
}

function isMissingSchemaRead(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'P2021' || code === 'P2022';
}

/**
 * POS 端的歷史清單。只回傳本店資料，不跨店。
 * 缺表環境回傳空清單並標記 unavailable，讓畫面能誠實說明而不是報錯。
 */
export async function loadMerchantSettlementHistory(
  client: PrismaClient,
  merchantId: string,
  limit = 20,
): Promise<{
  available: boolean;
  rows: Array<{
    id: string;
    settlementNo: string;
    status: string;
    rulesVersion: string | null;
    netPayableTwd: number | null;
    merchantOwesUs: number;
    periodStart: Date;
    periodEnd: Date;
    paidAt: Date | null;
    countsTowardValidTotals: boolean;
  }>;
}> {
  try {
    const rows = await client.settlement.findMany({
      where: { merchantId },
      select: {
        id: true,
        settlementId: true,
        status: true,
        rulesVersion: true,
        netPayableTwd: true,
        merchantOwesUs: true,
        periodStart: true,
        periodEnd: true,
        paidAt: true,
      },
      orderBy: [{ periodEnd: 'desc' }, { settlementId: 'desc' }],
      take: limit,
    });

    return {
      available: true,
      rows: rows.map((row) => ({
        id: row.id,
        settlementNo: row.settlementId,
        status: row.status,
        rulesVersion: row.rulesVersion,
        netPayableTwd: row.netPayableTwd,
        merchantOwesUs: row.merchantOwesUs,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        paidAt: row.paidAt,
        countsTowardValidTotals: countsTowardValidTotals(row.status),
      })),
    };
  } catch (error) {
    if (isMissingSchemaRead(error)) return { available: false, rows: [] };
    throw error;
  }
}

export { LEGACY_FLOAT_TOLERANCE };
