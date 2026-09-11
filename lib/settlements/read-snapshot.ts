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
  SETTLEMENT_SOURCE_DIRECTIONS,
  SETTLEMENT_SOURCE_KINDS,
  UnknownSourceKindError,
  computeLegacyTotals,
  isIntegerTwdInRange,
  withinLegacyTolerance,
  type SettlementSourceDirection,
} from '@/lib/settlements/source-snapshot';

export const SETTLEMENT_SNAPSHOT_BROKEN_ERROR =
  '這張結帳單的來源明細和總額對不起來，為了避免看到錯誤金額已經停止顯示。請聯絡總部檢查，資料沒有被改動。';

export const SETTLEMENT_SNAPSHOT_EMPTY_ERROR =
  '這張結帳單標記為新版結算，但找不到來源明細。請聯絡總部檢查，資料沒有被改動。';

export const SETTLEMENT_UNKNOWN_VERSION_ERROR =
  '這張結帳單是這個版本的系統還看不懂的結算版本，為了避免算錯金額已經停止顯示。請聯絡總部，資料沒有被改動。';

export const SETTLEMENT_UNKNOWN_SOURCE_KIND_ERROR =
  '這張結帳單裡有這個版本的系統還看不懂的來源種類，為了避免算錯金額已經停止顯示。請聯絡總部，資料沒有被改動。';

export const SETTLEMENT_INVALID_AMOUNT_ERROR =
  '這張結帳單裡有無法計算的金額，為了避免顯示錯誤數字已經停止顯示。請聯絡總部檢查，資料沒有被改動。';

export const SETTLEMENT_INCOMPLETE_SALE_ERROR =
  '這張結帳單裡有寄賣銷售缺少數量、單價或分潤，無法重現當時的金額。請聯絡總部檢查，資料沒有被改動。';

export const SETTLEMENT_VOID_STATE_ERROR =
  '這張結帳單的撤回狀態和來源明細對不起來，為了避免看到錯誤金額已經停止顯示。請聯絡總部檢查，資料沒有被改動。';

export const SETTLEMENT_INVALID_HEADER_ERROR =
  '這張結帳單存下的總額欄位無法解讀，為了避免顯示錯誤數字已經停止顯示。請聯絡總部檢查，資料沒有被改動。';

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
/**
 * 來源列本身是否可解讀。
 *
 * 必須在任何加總之前跑完：未知種類、非有限金額或缺必要欄位都要變成可讀錯誤，
 * 不能讓加總拋例外變成 500 白畫面，也不能被默默當成別種來源加進淨額。
 */
export function validateSnapshotSources(
  auditSources: readonly SettlementSourceRow[],
): { ok: true } | { ok: false; error: string } {
  const finite = (value: number | null): boolean => value == null || Number.isFinite(value);

  for (const row of auditSources) {
    if (!(SETTLEMENT_SOURCE_KINDS as readonly string[]).includes(row.sourceKind)) {
      return { ok: false, error: SETTLEMENT_UNKNOWN_SOURCE_KIND_ERROR };
    }
    if (!(SETTLEMENT_SOURCE_DIRECTIONS as readonly string[]).includes(row.direction)) {
      return { ok: false, error: SETTLEMENT_UNKNOWN_SOURCE_KIND_ERROR };
    }
    if (
      !Number.isFinite(row.originalAmount) ||
      !finite(row.unitPrice) ||
      !finite(row.commissionAmount) ||
      !finite(row.companyRevenue) ||
      (row.quantity != null && !Number.isSafeInteger(row.quantity))
    ) {
      return { ok: false, error: SETTLEMENT_INVALID_AMOUNT_ERROR };
    }
    if (
      row.sourceKind === 'consignment_sale' &&
      (row.quantity == null || row.unitPrice == null || row.commissionAmount == null)
    ) {
      return { ok: false, error: SETTLEMENT_INCOMPLETE_SALE_ERROR };
    }
  }

  return { ok: true };
}

/**
 * header 存下的總額欄位本身是否可解讀。
 *
 * 必須在把 header 餵進 Decimal 加總之前跑完：非有限的 legacy Float 會讓
 * `new Prisma.Decimal()` 直接拋例外，而超出整數台幣範圍的 netPayableTwd／
 * storeCollected 無法與重算值比較。兩者都要變成可讀錯誤，不是 500。
 */
export function validateSnapshotHeader(
  header: SettlementHeaderRow,
): { ok: true } | { ok: false; error: string } {
  const legacyFloats = [
    header.grossSales,
    header.commissionAmount,
    header.rewardPayout,
    header.shippingFee,
    header.merchantOwesUs,
    header.payable,
  ];
  if (legacyFloats.some((value) => !Number.isFinite(value))) {
    return { ok: false, error: SETTLEMENT_INVALID_HEADER_ERROR };
  }

  if (
    !isIntegerTwdInRange(header.netPayableTwd as number) ||
    !isIntegerTwdInRange(header.storeCollected as number)
  ) {
    return { ok: false, error: SETTLEMENT_INVALID_HEADER_ERROR };
  }

  return { ok: true };
}

/**
 * 撤回是整張的操作，不是逐筆的。
 *
 * cancelled 必須每一列都已作廢；其他狀態必須每一列都還在 active。
 * 部分作廢代表資料被半套改動過，必須 fail closed，不得照著 header 顯示金額。
 */
export function verifyVoidState(
  header: SettlementHeaderRow,
  auditSources: readonly SettlementSourceRow[],
): { ok: true } | { ok: false; error: string } {
  const voided = auditSources.filter((row) => row.voidedAt != null).length;
  const expectedVoided = header.status === 'cancelled' ? auditSources.length : 0;
  return voided === expectedVoided ? { ok: true } : { ok: false, error: SETTLEMENT_VOID_STATE_ERROR };
}

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

  const readableHeader = validateSnapshotHeader(header);
  if (!readableHeader.ok) return readableHeader;

  const readable = validateSnapshotSources(auditSources);
  if (!readable.ok) return readable;

  const voidState = verifyVoidState(header, auditSources);
  if (!voidState.ok) return voidState;

  // 與寫入端完全相同的 Decimal 口徑，S 取 header 已存的 legacy 運費。
  // 逐列都已驗過是有限數值，但加總後仍可能超出整數台幣範圍（例如被外部
  // 直接寫入的極大值）。那時 computeLegacyTotals 會丟例外，必須在這裡
  // 轉成可讀錯誤，不能讓它冒泡成 500。
  let totals: ReturnType<typeof computeLegacyTotals>;
  try {
    totals = computeLegacyTotals(auditSources, { shippingFee: header.shippingFee });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof UnknownSourceKindError
          ? SETTLEMENT_UNKNOWN_SOURCE_KIND_ERROR
          : SETTLEMENT_INVALID_AMOUNT_ERROR,
    };
  }

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
 * 已被 active canonical 唯一鍵占用的來源。
 *
 * 寄賣銷售有 `MerchantStockTxn.settlementId` 可以過濾，但券與代收付款沒有欄位鎖，
 * 它們的鎖就是這個唯一鍵。預覽若不排除，已結過的券會重複出現在暫計金額裡，
 * 送出時才被資料庫擋下，變成店員看得到卻永遠送不出去的數字。
 *
 * 缺表環境回傳 unavailable，由呼叫端決定如何誠實說明，不在這裡假裝沒有鎖。
 */
export async function loadActiveSourceKeys(
  client: PrismaClient,
  merchantId: string,
  sourceKeys: readonly string[],
): Promise<{ available: boolean; lockedKeys: Set<string> }> {
  if (sourceKeys.length === 0) return { available: true, lockedKeys: new Set() };
  try {
    const rows = await client.settlementSourceItem.findMany({
      where: { merchantId, sourceKey: { in: [...sourceKeys] }, voidedAt: null },
      select: { sourceKey: true },
    });
    return { available: true, lockedKeys: new Set(rows.map((row) => row.sourceKey)) };
  } catch (error) {
    if (isMissingSchemaRead(error)) return { available: false, lockedKeys: new Set() };
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
