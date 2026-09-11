/**
 * 結算寫入路徑：草稿建立、來源鎖定、撤回與刪除守衛。
 *
 * 凍結規格見 docs/reviews/pos-settlement-v1.md。核心不變條件：
 * - POS 只建立 draft，不寫 paidAt，不得標記已付款。
 * - header、來源明細與來源鎖必須在同一個交易內完成。
 * - 真正的防線是資料庫唯一約束，不是先讀後寫。
 * - 寄賣銷售鎖定必須帶 settlementId IS NULL 條件並做筆數斷言。
 * - 來源衝突不得被當成編號碰撞重試。
 *
 * Prisma client 由呼叫端注入（型別為 type-only import），模組本身不建立連線，
 * 因此純邏輯部分可以在沒有資料庫的環境單元測試。
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import {
  POS_SETTLEMENT_RULES_VERSION,
  amountsDigest,
  assertIntegerTwdRange,
  buildIdempotencyKey,
  buildPayloadFingerprint,
  computeLegacyTotals,
  consignmentSaleTxnIdFromKey,
  dedupeSources,
  sourceKeysDigest,
  type SettlementLegacyTotals,
  type SettlementSourceDraft,
} from '@/lib/settlements/source-snapshot';

export const SETTLEMENT_WRITE_FLAG_ENV = 'POS_SETTLEMENT_WRITE_ENABLED';

export const SETTLEMENT_SCHEMA_MISSING_ERROR =
  '這個環境還沒有結算來源明細表，無法寫入結帳紀錄。畫面數字可以先對，等總部完成資料庫更新後再送出。';

export const SETTLEMENT_WRITE_DISABLED_ERROR =
  '店家結帳寫入功能尚未啟用，這次沒有留下任何紀錄。畫面數字可以先對，等總部開啟後再送出。';

export const SETTLEMENT_NO_SOURCES_ERROR = '這段期間沒有可以結算的項目，不會建立結帳紀錄。';

export const SETTLEMENT_STALE_PREVIEW_ERROR =
  '畫面上的資料已經變動，請重新整理後再送出，避免結錯金額。';

export const SETTLEMENT_PAYLOAD_CONFLICT_ERROR =
  '同一次送出的內容和先前不一致，為了安全已經擋下。請重新整理後再送出。';

export const SETTLEMENT_SOURCE_CONFLICT_ERROR =
  '其中有項目已經被其他結帳單結過了，整批都沒有送出。請重新整理後再確認。';

export const SETTLEMENT_LOCK_CONFLICT_ERROR =
  '有銷售紀錄在送出的同時被其他結帳單鎖定，整批都沒有送出。請重新整理後再確認。';

export const SETTLEMENT_NOT_WITHDRAWABLE_ERROR =
  '這張結帳單已經送出審核或已處理，店家不能自行撤回。請聯絡總部。';

export const SETTLEMENT_HAS_SOURCE_ITEMS_ERROR =
  '這張結算已經有來源明細，為了保留稽核紀錄不能刪除。請改用撤回或建立沖銷。';

/** 伺服器端寫入開關。預設關閉；只讀伺服器環境變數，不得暴露到前端。 */
export function settlementWriteEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[SETTLEMENT_WRITE_FLAG_ENV] === 'true';
}

export type SettlementPaymentMethod =
  | 'BANK_TRANSFER'
  | 'FURMOSA_BALANCE'
  | 'OTHER_APPROVED'
  | 'FURMOSA_TO_STORE_TRANSFER'
  | 'NONE';

export type SettlementDraft = {
  rulesVersion: string;
  merchantId: string;
  periodStart: Date;
  periodEnd: Date;
  intendedPaymentMethod: SettlementPaymentMethod;
  sources: SettlementSourceDraft[];
  totals: SettlementLegacyTotals;
  sourceKeysDigest: string;
  amountsDigest: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  note: string | null;
};

export function buildSettlementDraft(input: {
  merchantId: string;
  periodStart: Date;
  periodEnd: Date;
  intendedPaymentMethod: SettlementPaymentMethod;
  sources: readonly SettlementSourceDraft[];
  note?: string | null;
}): SettlementDraft {
  const sources = dedupeSources(input.sources);
  const totals = computeLegacyTotals(sources);
  const keysDigest = sourceKeysDigest(sources);
  const valuesDigest = amountsDigest(sources, totals);
  const idempotencyKey = buildIdempotencyKey({
    merchantId: input.merchantId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    sourceKeysDigest: keysDigest,
    intendedPaymentMethod: input.intendedPaymentMethod,
  });

  return {
    rulesVersion: POS_SETTLEMENT_RULES_VERSION,
    merchantId: input.merchantId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    intendedPaymentMethod: input.intendedPaymentMethod,
    sources,
    totals,
    sourceKeysDigest: keysDigest,
    amountsDigest: valuesDigest,
    idempotencyKey,
    payloadFingerprint: buildPayloadFingerprint(idempotencyKey, valuesDigest),
    note: input.note ?? null,
  };
}

export type SettlementWriteFailureCode =
  | 'WRITE_DISABLED'
  | 'SCHEMA_MISSING'
  | 'NO_SOURCES'
  | 'STALE_PREVIEW'
  | 'PAYLOAD_CONFLICT'
  | 'SOURCE_CONFLICT'
  | 'LOCK_CONFLICT'
  | 'NOT_WITHDRAWABLE';

export type SettlementWriteResult =
  | {
      ok: true;
      id: string;
      settlementNo: string;
      status: string;
      netPayableTwd: number;
      duplicate: boolean;
    }
  | { ok: false; code: SettlementWriteFailureCode; error: string };

const FAILURE_MESSAGE: Record<SettlementWriteFailureCode, string> = {
  WRITE_DISABLED: SETTLEMENT_WRITE_DISABLED_ERROR,
  SCHEMA_MISSING: SETTLEMENT_SCHEMA_MISSING_ERROR,
  NO_SOURCES: SETTLEMENT_NO_SOURCES_ERROR,
  STALE_PREVIEW: SETTLEMENT_STALE_PREVIEW_ERROR,
  PAYLOAD_CONFLICT: SETTLEMENT_PAYLOAD_CONFLICT_ERROR,
  SOURCE_CONFLICT: SETTLEMENT_SOURCE_CONFLICT_ERROR,
  LOCK_CONFLICT: SETTLEMENT_LOCK_CONFLICT_ERROR,
  NOT_WITHDRAWABLE: SETTLEMENT_NOT_WITHDRAWABLE_ERROR,
};

export function settlementWriteFailure(code: SettlementWriteFailureCode): SettlementWriteResult {
  return { ok: false, code, error: FAILURE_MESSAGE[code] };
}

// ---------------------------------------------------------------------------
// 錯誤分類：來源衝突不得被當成編號碰撞
// ---------------------------------------------------------------------------

type PrismaErrorLike = { code?: unknown; meta?: { target?: unknown } };

function errorCode(error: unknown): string | null {
  const code = (error as PrismaErrorLike | null)?.code;
  return typeof code === 'string' ? code : null;
}

function errorTargets(error: unknown): string[] {
  const target = (error as PrismaErrorLike | null)?.meta?.target;
  if (typeof target === 'string') return [target];
  if (Array.isArray(target)) return target.filter((item): item is string => typeof item === 'string');
  return [];
}

export type UniqueViolationKind =
  | 'settlement_no'
  | 'idempotency_key'
  | 'active_source_key'
  | 'other';

/**
 * P2002 分類。編號碰撞才可重試；idempotency 與 active source key 必須各自處理，
 * 不得被誤判成編號碰撞而重試出第二張結算。
 */
export function classifyUniqueViolation(error: unknown): UniqueViolationKind | null {
  if (errorCode(error) !== 'P2002') return null;
  const targets = errorTargets(error).map((item) => item.toLowerCase());
  const joined = targets.join(',');
  if (joined.includes('idempotencykey')) return 'idempotency_key';
  if (joined.includes('active_source_key') || joined.includes('sourcekey')) {
    return 'active_source_key';
  }
  if (joined.includes('settlementid_key') || targets.includes('settlementid')) {
    return 'settlement_no';
  }
  return 'other';
}

export function isMissingSchemaError(error: unknown): boolean {
  const code = errorCode(error);
  return code === 'P2021' || code === 'P2022';
}

export class SettlementLockConflictError extends Error {
  constructor(
    public readonly expected: number,
    public readonly locked: number,
  ) {
    super(SETTLEMENT_LOCK_CONFLICT_ERROR);
    this.name = 'SettlementLockConflictError';
  }
}

/** 鎖定筆數斷言。筆數不符必須讓整個交易回滾，不允許部分成功。 */
export function assertLockedCount(expected: number, locked: number): void {
  if (expected !== locked) throw new SettlementLockConflictError(expected, locked);
}

const SETTLEMENT_NO_MAX_ATTEMPTS = 5;

export function formatSettlementNo(periodEnd: Date, sequence: number): string {
  const ym = `${periodEnd.getFullYear()}${String(periodEnd.getMonth() + 1).padStart(2, '0')}`;
  return `SET-${ym}-${String(sequence).padStart(3, '0')}`;
}

/**
 * 與 lib/settlement-calc.ts 的 nextSettlementId 採同一個編號格式，
 * 但在交易內以注入的 client 執行，避免動到唯讀的 legacy 計算模組。
 */
async function nextSettlementNo(
  tx: Prisma.TransactionClient,
  periodEnd: Date,
): Promise<string> {
  const ym = `${periodEnd.getFullYear()}${String(periodEnd.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `SET-${ym}-`;
  const last = await tx.settlement.findFirst({
    where: { settlementId: { startsWith: prefix } },
    orderBy: { settlementId: 'desc' },
    select: { settlementId: true },
  });
  const nextSeq = last ? Number(last.settlementId.slice(prefix.length)) + 1 : 1;
  return formatSettlementNo(periodEnd, Number.isFinite(nextSeq) ? nextSeq : 1);
}

function existingResult(row: {
  id: string;
  settlementId: string;
  status: string;
  netPayableTwd: number | null;
}): SettlementWriteResult {
  return {
    ok: true,
    id: row.id,
    settlementNo: row.settlementId,
    status: row.status,
    netPayableTwd: row.netPayableTwd ?? 0,
    duplicate: true,
  };
}

/**
 * 建立 POS 待核對草稿。
 *
 * 送出時必須重新驗證來源集合與金額摘要；改變即拒絕，不得靜默改變整批內容。
 * 同 key 同 payload 回傳既有結算；同 key 不同 payload 拒絕；部分重疊整批拒絕。
 */
export async function persistSettlementDraft(
  client: PrismaClient,
  draft: SettlementDraft,
  expected: { sourceKeysDigest: string; amountsDigest: string },
): Promise<SettlementWriteResult> {
  if (!settlementWriteEnabled()) return settlementWriteFailure('WRITE_DISABLED');
  if (draft.sources.length === 0) return settlementWriteFailure('NO_SOURCES');
  if (
    draft.sourceKeysDigest !== expected.sourceKeysDigest ||
    draft.amountsDigest !== expected.amountsDigest
  ) {
    return settlementWriteFailure('STALE_PREVIEW');
  }

  assertIntegerTwdRange(draft.totals.netPayableTwd, '本期淨額');
  assertIntegerTwdRange(draft.totals.storeCollected, '店家代收現金');

  for (let attempt = 1; attempt <= SETTLEMENT_NO_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await runPersistAttempt(client, draft);
    } catch (error) {
      if (isMissingSchemaError(error)) return settlementWriteFailure('SCHEMA_MISSING');
      if (error instanceof SettlementLockConflictError) {
        return settlementWriteFailure('LOCK_CONFLICT');
      }

      const violation = classifyUniqueViolation(error);
      if (violation === 'settlement_no' && attempt < SETTLEMENT_NO_MAX_ATTEMPTS) continue;
      if (violation === 'idempotency_key') {
        const existing = await findByIdempotencyKey(client, draft.idempotencyKey);
        if (!existing) return settlementWriteFailure('PAYLOAD_CONFLICT');
        return existing.payloadFingerprint === draft.payloadFingerprint
          ? existingResult(existing)
          : settlementWriteFailure('PAYLOAD_CONFLICT');
      }
      if (violation === 'active_source_key') return settlementWriteFailure('SOURCE_CONFLICT');
      throw error;
    }
  }

  return settlementWriteFailure('LOCK_CONFLICT');
}

async function findByIdempotencyKey(client: PrismaClient, idempotencyKey: string) {
  return client.settlement.findFirst({
    where: { idempotencyKey },
    select: {
      id: true,
      settlementId: true,
      status: true,
      netPayableTwd: true,
      payloadFingerprint: true,
    },
  });
}

async function runPersistAttempt(
  client: PrismaClient,
  draft: SettlementDraft,
): Promise<SettlementWriteResult> {
  const before = await findByIdempotencyKey(client, draft.idempotencyKey);
  if (before) {
    return before.payloadFingerprint === draft.payloadFingerprint
      ? existingResult(before)
      : settlementWriteFailure('PAYLOAD_CONFLICT');
  }

  return client.$transaction(async (tx) => {
    const inTx = await tx.settlement.findFirst({
      where: { idempotencyKey: draft.idempotencyKey },
      select: {
        id: true,
        settlementId: true,
        status: true,
        netPayableTwd: true,
        payloadFingerprint: true,
      },
    });
    if (inTx) {
      return inTx.payloadFingerprint === draft.payloadFingerprint
        ? existingResult(inTx)
        : settlementWriteFailure('PAYLOAD_CONFLICT');
    }

    const settlementNo = await nextSettlementNo(tx, draft.periodEnd);
    const created = await tx.settlement.create({
      data: {
        settlementId: settlementNo,
        merchantId: draft.merchantId,
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd,
        grossSales: draft.totals.grossSales,
        commissionRate: draft.totals.commissionRate,
        commissionAmount: draft.totals.commissionAmount,
        rewardPayout: draft.totals.rewardPayout,
        shippingFee: draft.totals.shippingFee,
        merchantOwesUs: draft.totals.merchantOwesUs,
        payable: draft.totals.payable,
        // POS 只建立待核對草稿，永遠不寫 paidAt。
        status: 'draft',
        note: draft.note,
        rulesVersion: draft.rulesVersion,
        idempotencyKey: draft.idempotencyKey,
        payloadFingerprint: draft.payloadFingerprint,
        createdSource: 'pos',
        intendedPaymentMethod: draft.intendedPaymentMethod,
        netPayableTwd: draft.totals.netPayableTwd,
        storeCollected: draft.totals.storeCollected,
      },
      select: { id: true, settlementId: true, status: true, netPayableTwd: true },
    });

    await tx.settlementSourceItem.createMany({
      data: draft.sources.map((source) => ({
        settlementId: created.id,
        merchantId: draft.merchantId,
        sourceKind: source.sourceKind,
        sourceKey: source.sourceKey,
        direction: source.direction,
        originalAmount: source.originalAmount,
        quantity: source.quantity,
        unitPrice: source.unitPrice,
        commissionAmount: source.commissionAmount,
        companyRevenue: source.companyRevenue,
        occurredAt: source.occurredAt,
        relatedOrderId: source.relatedOrderId,
        sourceSnapshot: source.sourceSnapshot as Prisma.InputJsonValue,
        rulesVersion: draft.rulesVersion,
      })),
    });

    const txnIds = draft.sources
      .map((source) => consignmentSaleTxnIdFromKey(source.sourceKey))
      .filter((id): id is string => id !== null);

    if (txnIds.length > 0) {
      // 條件鎖定：只接受尚未被任何結算鎖住的流水，並斷言筆數。
      // 這同時修復既有 HQ 建立路徑會搶走他人鎖的缺陷。
      const locked = await tx.merchantStockTxn.updateMany({
        where: { id: { in: txnIds }, merchantId: draft.merchantId, settlementId: null },
        data: { settlementId: created.id },
      });
      assertLockedCount(txnIds.length, locked.count);
    }

    return {
      ok: true as const,
      id: created.id,
      settlementNo: created.settlementId,
      status: created.status,
      netPayableTwd: created.netPayableTwd ?? draft.totals.netPayableTwd,
      duplicate: false,
    };
  });
}

/**
 * 店家撤回自己的新版草稿。
 *
 * 以資料庫條件轉移狀態並做筆數斷言，避免與 HQ 推進狀態競態。
 * 明細標記 voidedAt 以釋放 active 唯一鍵，稽核列保留；只釋放自己的鎖。
 * 原 key 重送不會讓已撤回的結算復活，因為 idempotencyKey 仍被該列占用，
 * 而重新結算必須使用新的操作 key。
 */
export async function withdrawSettlementDraft(
  client: PrismaClient,
  input: { merchantId: string; settlementId: string },
): Promise<SettlementWriteResult> {
  if (!settlementWriteEnabled()) return settlementWriteFailure('WRITE_DISABLED');

  try {
    return await client.$transaction(async (tx) => {
      const moved = await tx.settlement.updateMany({
        where: {
          id: input.settlementId,
          merchantId: input.merchantId,
          status: 'draft',
          rulesVersion: POS_SETTLEMENT_RULES_VERSION,
          createdSource: 'pos',
        },
        data: { status: 'cancelled' },
      });
      if (moved.count !== 1) return settlementWriteFailure('NOT_WITHDRAWABLE');

      const now = new Date();
      await tx.settlementSourceItem.updateMany({
        where: { settlementId: input.settlementId, voidedAt: null },
        data: { voidedAt: now },
      });
      await tx.merchantStockTxn.updateMany({
        where: { settlementId: input.settlementId },
        data: { settlementId: null },
      });

      const row = await tx.settlement.findUniqueOrThrow({
        where: { id: input.settlementId },
        select: { id: true, settlementId: true, status: true, netPayableTwd: true },
      });
      return {
        ok: true as const,
        id: row.id,
        settlementNo: row.settlementId,
        status: row.status,
        netPayableTwd: row.netPayableTwd ?? 0,
        duplicate: false,
      };
    });
  } catch (error) {
    if (isMissingSchemaError(error)) return settlementWriteFailure('SCHEMA_MISSING');
    throw error;
  }
}

/**
 * HQ 刪除守衛。帶有來源明細的結算不得刪除，稽核不可連帶消失。
 * 資料庫的 ON DELETE RESTRICT 是最後防線，這裡負責給出可讀訊息。
 */
export function assertSettlementDeletable(input: {
  rulesVersion: string | null;
  sourceItemCount: number;
}): void {
  if (input.sourceItemCount > 0 || input.rulesVersion != null) {
    throw new Error(SETTLEMENT_HAS_SOURCE_ITEMS_ERROR);
  }
}
