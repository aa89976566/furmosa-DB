/**
 * 結算讀取路徑：新版身份判定、快照讀取與漂移不變條件。
 *
 * 凍結規格見 docs/reviews/pos-settlement-v1.md。核心不變條件：
 * - 新版身份只看 rulesVersion，絕不以「有沒有明細列」推測。
 * - 未知的非空版本與缺必要欄位一律 fail closed，不得套本版公式、不得以 0 代替金額。
 * - 新版結算一律讀已存快照，不重算，也不呼叫 calcSettlement。
 * - 舊版（rulesVersion 為 null）維持原路徑，本模組不介入。
 * - header 是送出當時的不可變快照，以**保留的全部稽核來源**驗證；
 *   撤回會把明細標 voidedAt，但不得因此把合法的已撤回結算判為損毀或清零歷史。
 * - cancelled 不計入有效財務總計。
 * - 加總與寫入共用同一個 Prisma.Decimal 函式，半元邊界才不會得出不同的整數淨額。
 *
 * Prisma client 由呼叫端注入（型別為 type-only import），模組本身不建立連線，
 * 因此純邏輯部分可以在沒有資料庫的環境單元測試。
 */

import type { PrismaClient } from '@prisma/client';
import {
  LEGACY_FLOAT_TOLERANCE,
  POS_SETTLEMENT_RULES_VERSION,
  computeLegacyTotals,
  withinLegacyTolerance,
  type SettlementSourceDirection,
} from '@/lib/settlements/source-snapshot';

export const SETTLEMENT_SNAPSHOT_BROKEN_ERROR =
  '這張結帳單的來源明細和總額對不起來，為了避免看到錯誤金額已經停止顯示。請聯絡總部檢查，資料沒有被改動。';

export const SETTLEMENT_SNAPSHOT_EMPTY_ERROR =
  '這張結帳單標記為新版結算，但找不到來源明細。請聯絡總部檢查，資料沒有被改動。';

export const SETTLEMENT_UNKNOWN_VERSION_ERROR =
  '這張結帳單是這個版本的系統還看不懂的結算版本，為了避免算錯金額已經停止顯示。請聯絡總部，資料沒有被改動。';

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

/**
 * 是否帶有來源快照（任何非空版本）。
 *
 * 只用來判斷「該不該走快照分支」，**不足以**判斷能不能解讀；
 * 能不能解讀由 isPosSettlementVersion 決定，未知版本必須 fail closed。
 */
export function hasSourceSnapshot(rulesVersion: string | null | undefined): boolean {
  return rulesVersion != null && rulesVersion.length > 0;
}

export function countsTowardValidTotals(status: string): boolean {
  return !(SETTLEMENT_EXCLUDED_STATUSES as readonly string[]).includes(status);
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
  /** 保留的全部稽核來源。金額驗證的依據。 */
  auditSources: SettlementSourceRow[];
  /** 仍占用 active canonical 唯一鍵的來源。 */
  activeSources: SettlementSourceRow[];
  /** 已撤回的稽核殘留，只顯示、不釋放稽核。 */
  voidedSources: SettlementSourceRow[];
  /** 送出當時存下的整數淨額。已撤回也保留原值，不清零。 */
  netPayableTwd: number;
  direction: SettlementSourceDirection | 'NONE';
  withdrawn: boolean;
  countsTowardValidTotals: boolean;
};

export type SettlementSnapshotResult =
  | { ok: true; view: SettlementSnapshotView }
  | { ok: false; error: string };

/**
 * 漂移不變條件。
 *
 * 驗證對象是 header 與**保留的全部稽核來源**，因為 header 記錄的是送出當時的內容；
 * 撤回只標記 voidedAt，不改 header，也不應讓 header 變成「對不起來」。
 *
 * legacy Float 合計允許 0.01 的比較容差（浮點加總誤差）；
 * 已存的整數欄位（netPayableTwd、storeCollected）必須完全相等，不得套用任何容差。
 */
export function verifySnapshotIntegrity(
  header: SettlementHeaderRow,
  auditSources: readonly SettlementSourceRow[],
): { ok: true } | { ok: false; error: string } {
  if (header.netPayableTwd == null || header.storeCollected == null) {
    return { ok: false, error: SETTLEMENT_SNAPSHOT_BROKEN_ERROR };
  }
  if (auditSources.length === 0) {
    return { ok: false, error: SETTLEMENT_SNAPSHOT_EMPTY_ERROR };
  }

  // 與寫入端完全相同的 Decimal 口徑，S 取 header 已存的 legacy 運費。
  const totals = computeLegacyTotals(auditSources, { shippingFee: header.shippingFee });

  const floatChecks: Array<[number, number]> = [
    [header.grossSales, totals.grossSales],
    [header.commissionAmount, totals.commissionAmount],
    [header.rewardPayout, totals.rewardPayout],
    [header.payable, totals.payable],
    [header.merchantOwesUs, totals.merchantOwesUs],
  ];
  if (floatChecks.some(([stored, recomputed]) => !withinLegacyTolerance(stored, recomputed))) {
    return { ok: false, error: SETTLEMENT_SNAPSHOT_BROKEN_ERROR };
  }

  if (
    header.netPayableTwd !== totals.netPayableTwd ||
    header.storeCollected !== totals.storeCollected
  ) {
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
  // fail closed：未知版本的語意未知，絕不套用本版公式解讀。
  if (!isPosSettlementVersion(header.rulesVersion)) {
    return { ok: false, error: SETTLEMENT_UNKNOWN_VERSION_ERROR };
  }

  const integrity = verifySnapshotIntegrity(header, sources);
  if (!integrity.ok) return integrity;

  const auditSources = [...sources];
  const activeSources = auditSources.filter((row) => row.voidedAt == null);
  const voidedSources = auditSources.filter((row) => row.voidedAt != null);
  const netPayableTwd = header.netPayableTwd as number;

  return {
    ok: true,
    view: {
      header,
      auditSources,
      activeSources,
      voidedSources,
      netPayableTwd,
      direction:
        netPayableTwd > 0 ? 'STORE_TO_FURMOSA' : netPayableTwd < 0 ? 'FURMOSA_TO_STORE' : 'NONE',
      withdrawn: activeSources.length === 0 && voidedSources.length > 0,
      countsTowardValidTotals: countsTowardValidTotals(header.status),
    },
  };
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

function isMissingSchemaRead(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'P2021' || code === 'P2022';
}

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

/**
 * 操作序號：這組來源在本店已經被幾張結算作廢過。
 *
 * 由伺服器推導、不可由瀏覽器提供，用來讓撤回後的重新結算取得新的 idempotencyKey。
 * 缺表環境回傳 0 並標記 unavailable，由寫入端拒絕，不在這裡假裝成功。
 */
export async function countVoidedAttempts(
  client: PrismaClient,
  merchantId: string,
  sourceKeys: readonly string[],
): Promise<{ available: boolean; operationSeq: number }> {
  if (sourceKeys.length === 0) return { available: true, operationSeq: 0 };
  try {
    const rows = await client.settlementSourceItem.findMany({
      where: {
        merchantId,
        sourceKey: { in: [...sourceKeys] },
        voidedAt: { not: null },
      },
      select: { settlementId: true },
      distinct: ['settlementId'],
    });
    return { available: true, operationSeq: rows.length };
  } catch (error) {
    if (isMissingSchemaRead(error)) return { available: false, operationSeq: 0 };
    throw error;
  }
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
