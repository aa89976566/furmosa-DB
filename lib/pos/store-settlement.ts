import {
  isIncludedInSettlement,
  netSettlement,
  summarizeStoreLedger,
  type LedgerEntry,
} from '@/lib/pos/store-ledger';
import {
  computeLegacyTotals,
  type SettlementLegacyTotals,
  type SettlementSourceDraft,
} from '@/lib/settlements/source-snapshot';
import {
  buildSettlementDraft,
  findSettlementByPreviewKey,
  persistSettlementDraft,
  priorSettlementResult,
  settlementReadiness,
  settlementWriteEnabled,
  settlementWriteFailure,
  withdrawSettlementDraft,
  SETTLEMENT_PAYMENT_METHOD_INVALID_ERROR,
  SETTLEMENT_WRITE_DISABLED_ERROR,
  type PriorSettlement,
  type SettlementDraft,
  type SettlementWriteResult,
  type SubmittedPreview,
} from '@/lib/settlements/write-settlement';

export const STORE_SETTLEMENT_SCHEMA_MISSING =
  '目前還沒有店家對帳結算表，無法寫入結帳紀錄。畫面數字可以先對，等總部確認後再新增 StoreSettlement。';

export type StoreSettlementPaymentMethod =
  | 'BANK_TRANSFER'
  | 'FURMOSA_BALANCE'
  | 'OTHER_APPROVED'
  | 'FURMOSA_TO_STORE_TRANSFER'
  | 'NONE';

export type StoreSettlementSnapshot = {
  storeId: string;
  periodStart: Date;
  periodEnd: Date;
  storePayable: number;
  furmosaPayable: number;
  netAmount: number;
  payer: 'STORE' | 'FURMOSA' | 'NONE';
  receiver: 'STORE' | 'FURMOSA' | 'NONE';
  paymentMethod: StoreSettlementPaymentMethod;
  itemSourceIds: string[];
  items: Array<{
    sourceId: string;
    amount: number;
    direction: 'STORE_TO_FURMOSA' | 'FURMOSA_TO_STORE';
    relatedOrderId: string | null;
  }>;
};

export class DuplicateSettlementError extends Error {
  constructor(public readonly sourceIds: string[]) {
    super('這筆流水已經結過帳，不能再加入新的結帳');
    this.name = 'DuplicateSettlementError';
  }
}

export function paymentMethodLabel(method: StoreSettlementPaymentMethod): string {
  switch (method) {
    case 'BANK_TRANSFER':
      return '銀行轉帳';
    case 'FURMOSA_BALANCE':
      return '匠寵餘額折抵';
    case 'OTHER_APPROVED':
      return '其他已核准方式';
    case 'FURMOSA_TO_STORE_TRANSFER':
      return '匠寵匯款至店家帳戶';
    case 'NONE':
      return '本期無需付款';
  }
}

export function allowedPaymentMethods(
  payer: StoreSettlementSnapshot['payer'],
): StoreSettlementPaymentMethod[] {
  if (payer === 'STORE') return ['BANK_TRANSFER', 'FURMOSA_BALANCE', 'OTHER_APPROVED'];
  if (payer === 'FURMOSA') return ['FURMOSA_TO_STORE_TRANSFER'];
  return ['NONE'];
}

/**
 * 收付方向一律由**可信且未鎖定來源**的 Decimal 淨額決定，不看 legacy 對帳摘要。
 *
 * legacy `summary.payer` 來自 `summarizeStoreLedger(entries)`，而 entries 少了寄賣銷售、
 * 又含已被別張結帳單鎖住的券，因此它的方向可能與實際要送出的淨額相反；淨額為零時
 * 更會選到錯的付款方式。
 */
export function payerFromDirection(
  direction: SettlementLegacyTotals['direction'],
): StoreSettlementSnapshot['payer'] {
  if (direction === 'STORE_TO_FURMOSA') return 'STORE';
  if (direction === 'FURMOSA_TO_STORE') return 'FURMOSA';
  return 'NONE';
}

/**
 * 解析瀏覽器選的結帳方式。
 *
 * **不得 fallback 到別的付款方式**：付款方式納入冪等 key，悄悄換一個等於用不同的
 * key 寫入，畫面顯示的方式也會與實際存下的不符。不適用就擋下並要求重新整理。
 */
export function resolveRequestedPaymentMethod(input: {
  requested: string;
  payer: StoreSettlementSnapshot['payer'];
}): { ok: true; method: StoreSettlementPaymentMethod } | { ok: false; error: string } {
  const allowed = allowedPaymentMethods(input.payer);
  const match = allowed.find((method) => method === input.requested);
  if (!match) {
    return { ok: false, error: SETTLEMENT_PAYMENT_METHOD_INVALID_ERROR };
  }
  return { ok: true, method: match };
}

/**
 * 送出後要顯示的訊息。
 *
 * 重送舊 key 會回到原本那一張，而原本那張可能已經撤回或已撥款；一律說「待核對」
 * 會直接誤導店家。因此訊息必須依實際狀態產生。
 *
 * `paidAt` 必須由資料庫帶進來，不得由 `status` 推導：`status = 'paid'` 但沒有撥款
 * 時間代表資料不一致，這種情況**不得**告訴店家已經撥款完成，否則店家會當成已收到錢。
 * 與歷史列表的 `settlementHistoryStatusView` 採同一條規則。
 */
export function submittedSettlementMessage(input: {
  duplicate: boolean;
  settlementNo: string;
  status: string;
  paidAt: Date | null;
}): string {
  const { settlementNo: no } = input;
  if (input.status === 'cancelled') {
    return `這期先前送出的 ${no} 已經撤回，撤回紀錄保留。請重新整理後再送出新的一張。`;
  }
  if (input.status === 'paid') {
    return input.paidAt
      ? `${no} 已經撥款完成，不會重複建立，也沒有新增任何紀錄。`
      : `${no} 標記為已撥款但沒有撥款時間，資料不一致。這次沒有新增任何紀錄，請先聯絡總部確認，不要當成已經收到款。`;
  }
  if (input.status === 'reviewing' || input.status === 'approved') {
    return `${no} 已經在總部審核中，不會重複建立。撥款完成前都不算已付款。`;
  }
  if (input.duplicate) {
    return `這期已經送出過了，還是同一張 ${no}，狀態待總部核對。`;
  }
  return `已送出待核對 ${no}。總部核對後才會撥款，這不是已付款。`;
}

export type SettleOverview = {
  storeOwesFurmosa: number;
  furmosaOwesStore: number;
  submittedNet: number;
  submittedCount: number;
  netPayableTwd: number;
  payer: StoreSettlementSnapshot['payer'];
  resultLabel: string;
};

/**
 * POS 總覽四張卡與淨額的唯一數字來源。
 *
 * 應收應付只取本次可結算的 Decimal totals；已結算金額改讀**已送出的快照**
 * （`history`），不再用 legacy 對帳摘要的 `settledAmount`，避免同一畫面兩套金額。
 */
export function buildSettleOverview(input: {
  totals: Pick<SettlementLegacyTotals, 'netPayableTwd' | 'direction'>;
  history: ReadonlyArray<{
    netPayableTwd: number | null;
    merchantOwesUs: number;
    periodStart: string;
    periodEnd: string;
    countsTowardValidTotals: boolean;
  }>;
  periodStart: string;
  periodEnd: string;
}): SettleOverview {
  const net = input.totals.netPayableTwd;
  const payer = payerFromDirection(input.totals.direction);
  const submitted = input.history.filter(
    (row) =>
      row.countsTowardValidTotals &&
      row.periodStart === input.periodStart &&
      row.periodEnd === input.periodEnd,
  );

  return {
    storeOwesFurmosa: net > 0 ? net : 0,
    furmosaOwesStore: net < 0 ? -net : 0,
    submittedNet: submitted.reduce(
      (sum, row) => sum + Math.abs(row.netPayableTwd ?? row.merchantOwesUs),
      0,
    ),
    submittedCount: submitted.length,
    netPayableTwd: net,
    payer,
    resultLabel:
      payer === 'STORE' ? '店家應匯給匠寵' : payer === 'FURMOSA' ? '匠寵應匯給店家' : '本期無需付款',
  };
}

export function selectSettlementItems(entries: LedgerEntry[]): LedgerEntry[] {
  return entries.filter(isIncludedInSettlement);
}

export function assertSourcesNotSettled(entries: LedgerEntry[]): void {
  const duplicates = entries
    .filter((entry) => entry.settlementStatus === 'SETTLED')
    .map((entry) => entry.sourceId);
  if (duplicates.length > 0) {
    throw new DuplicateSettlementError(duplicates);
  }
}

export function buildSettlementSnapshot(input: {
  storeId: string;
  periodStart: Date;
  periodEnd: Date;
  entries: LedgerEntry[];
  paymentMethod: StoreSettlementPaymentMethod;
  settledAmount?: number;
}): StoreSettlementSnapshot {
  const billable = input.entries.filter(
    (entry) =>
      entry.fundDirection !== 'NO_SETTLEMENT' &&
      entry.amount !== 0 &&
      entry.settlementStatus !== 'EXCLUDED',
  );
  assertSourcesNotSettled(billable);
  const items = selectSettlementItems(input.entries);
  const summary = summarizeStoreLedger(items, input.settledAmount);
  const net = netSettlement(summary.storeOwesFurmosa, summary.furmosaOwesStore);
  const allowed = allowedPaymentMethods(net.payer);
  const paymentMethod = allowed.includes(input.paymentMethod) ? input.paymentMethod : allowed[0]!;

  return {
    storeId: input.storeId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    storePayable: summary.storeOwesFurmosa,
    furmosaPayable: summary.furmosaOwesStore,
    netAmount: net.absoluteAmount,
    payer: net.payer,
    receiver: net.receiver,
    paymentMethod,
    itemSourceIds: items.map((item) => item.sourceId),
    items: items.map((item) => ({
      sourceId: item.sourceId,
      amount: item.amount,
      direction: item.fundDirection as 'STORE_TO_FURMOSA' | 'FURMOSA_TO_STORE',
      relatedOrderId: item.relatedOrderId,
    })),
  };
}

export type SettlementTx = {
  findSettledSourceIds: (sourceIds: string[]) => Promise<string[]>;
  createSettlement: (snapshot: StoreSettlementSnapshot) => Promise<{ id: string }>;
  createItems: (
    settlementId: string,
    items: StoreSettlementSnapshot['items'],
  ) => Promise<void>;
  markSourcesSettled: (sourceIds: string[], settlementId: string) => Promise<void>;
};

/**
 * 結帳必須同一筆交易完成：先建立結算紀錄與明細快照，再標記流水已結算。
 * 不可先標記再建立，避免中途失敗造成重複或漏結。
 */
export async function runSettlementTransaction(
  inTransaction: <T>(fn: (tx: SettlementTx) => Promise<T>) => Promise<T>,
  snapshot: StoreSettlementSnapshot,
): Promise<{ id: string }> {
  if (snapshot.itemSourceIds.length !== new Set(snapshot.itemSourceIds).size) {
    throw new DuplicateSettlementError(snapshot.itemSourceIds);
  }

  return inTransaction(async (tx) => {
    const duplicates = await tx.findSettledSourceIds(snapshot.itemSourceIds);
    if (duplicates.length > 0) {
      throw new DuplicateSettlementError(duplicates);
    }
    const settlement = await tx.createSettlement(snapshot);
    await tx.createItems(settlement.id, snapshot.items);
    await tx.markSourcesSettled(snapshot.itemSourceIds, settlement.id);
    return settlement;
  });
}

/**
 * POS 端寫入入口。
 *
 * 共用 `lib/settlements/write-settlement.ts` 的伺服器端閘門與交易，POS 與 HQ 不各寫一套。
 * 寫入開關關閉時在這裡就回絕，並且**不載入 prisma**：
 * 一方面沒有任何資料庫連線，另一方面讓純邏輯測試能在沒有 DATABASE_URL 的環境跑。
 */
export async function persistStoreSettlement(input: {
  draft: SettlementDraft;
  submitted: SubmittedPreview;
}): Promise<SettlementWriteResult> {
  if (!settlementWriteEnabled()) return settlementWriteFailure('WRITE_DISABLED');
  const { prisma } = await import('@/lib/prisma');
  return persistSettlementDraft(prisma, input.draft, input.submitted);
}

/** 依本店 + 原 key 找既有結算。key 來自瀏覽器，因此永遠限定本店。 */
export async function findPriorStoreSettlement(input: {
  merchantId: string;
  idempotencyKey: string;
}): Promise<PriorSettlement | null> {
  const { prisma } = await import('@/lib/prisma');
  return findSettlementByPreviewKey(prisma, input.merchantId, input.idempotencyKey);
}

export type ConfirmStoreSettlementInput = {
  merchantId: string;
  periodStart: Date;
  periodEnd: Date;
  /** 穩定的結帳方式代碼，不是畫面文字。 */
  paymentMethod: string;
  preview: {
    sourceKeysDigest: string;
    amountsDigest: string;
    idempotencyKey: string;
    payloadFingerprint: string;
  };
};

/**
 * 送出流程需要的外部相依。
 *
 * 全部由呼叫端注入，讓送出**順序**本身可以在沒有資料庫的環境回歸測試。
 * 只測 writer 不夠：R7 的缺陷正是出在 action 的呼叫順序，writer 本身是對的。
 */
export type ConfirmStoreSettlementDeps = {
  writeEnabled: () => boolean;
  findPrior: (input: {
    merchantId: string;
    idempotencyKey: string;
  }) => Promise<PriorSettlement | null>;
  loadSources: (input: {
    merchantId: string;
    periodStart: Date;
    periodEnd: Date;
  }) => Promise<{ sources: SettlementSourceDraft[]; lockStateAvailable: boolean }>;
  countAttempts: (input: {
    merchantId: string;
    sourceKeys: string[];
  }) => Promise<{ operationSeq: number; available: boolean }>;
  persist: (input: {
    draft: SettlementDraft;
    submitted: SubmittedPreview;
  }) => Promise<SettlementWriteResult>;
};

export type ConfirmStoreSettlementResult =
  | {
      ok: true;
      duplicate: boolean;
      settlementNo: string;
      status: string;
      netPayableTwd: number;
      paidAt: Date | null;
      message: string;
    }
  | { ok: false; error: string };

/**
 * 店家送出結帳的順序閘門。
 *
 * 順序本身就是正確性的一部分：
 * 1. 寫入開關：關閉時不讀任何資料。
 * 2. **先**用本店 + 原 key + 完整 fingerprint 找既有單，找到就回報它真實的狀態。
 *    第一次送出成功後來源會全部被鎖住，重新載入的預覽沒有任何可結算來源，收付方向
 *    也變成 NONE。若照舊先驗來源與付款方式，重按同一顆按鈕會先被擋在「沒有可結算
 *    項目」或「結帳方式不適用」，永遠回不到原單。
 * 3. 只有在查不到原單（真正的新送出）時才重算來源、驗就緒狀態與付款方式。
 *
 * 跨店：`findPrior` 限定本店，別家店的 key 在這裡查不到，會落入新送出分支並由
 * 來源／摘要比對擋下，不會沿用也不會洩漏別家店的結算。
 */
export async function confirmStoreSettlement(
  input: ConfirmStoreSettlementInput,
  deps: ConfirmStoreSettlementDeps,
): Promise<ConfirmStoreSettlementResult> {
  if (!deps.writeEnabled()) {
    return { ok: false, error: SETTLEMENT_WRITE_DISABLED_ERROR };
  }

  const prior = await deps.findPrior({
    merchantId: input.merchantId,
    idempotencyKey: input.preview.idempotencyKey,
  });
  if (prior) {
    return toConfirmResult(priorSettlementResult(prior, input.preview.payloadFingerprint));
  }

  // 以下是真正的新送出：金額一律由伺服器重算，不採用瀏覽器傳入的任何數字。
  const { sources, lockStateAvailable } = await deps.loadSources({
    merchantId: input.merchantId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });

  const attempts = await deps.countAttempts({
    merchantId: input.merchantId,
    sourceKeys: sources.map((source) => source.sourceKey),
  });

  // 讀不到鎖定狀態或操作序號時不得繼續：序號錯了會算出錯的冪等 key。
  // 也必須排在收付方向之前：sources 不完整時算出的方向可能相反。
  const readiness = settlementReadiness({
    writeEnabled: deps.writeEnabled(),
    lockStateAvailable,
    operationSeqAvailable: attempts.available,
  });
  if (!readiness.ok) return { ok: false, error: readiness.error };

  // 收付方向由可信且未鎖定來源的 Decimal 淨額決定，不看 legacy 對帳摘要。
  // 不適用的方式直接擋下，不 fallback：付款方式納入冪等 key，悄悄換一個
  // 等於用別的 key 寫入，畫面顯示的方式也會與實際存下的不符。
  const resolved = resolveRequestedPaymentMethod({
    requested: input.paymentMethod,
    payer: payerFromDirection(computeLegacyTotals(sources).direction),
  });
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const draft = buildSettlementDraft({
    merchantId: input.merchantId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    intendedPaymentMethod: resolved.method,
    operationSeq: attempts.operationSeq,
    sources,
  });

  return toConfirmResult(
    await deps.persist({
      draft,
      submitted: {
        sourceKeysDigest: input.preview.sourceKeysDigest,
        amountsDigest: input.preview.amountsDigest,
        idempotencyKey: input.preview.idempotencyKey,
        payloadFingerprint: input.preview.payloadFingerprint,
      },
    }),
  );
}

function toConfirmResult(result: SettlementWriteResult): ConfirmStoreSettlementResult {
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    duplicate: result.duplicate,
    settlementNo: result.settlementNo,
    status: result.status,
    netPayableTwd: result.netPayableTwd,
    paidAt: result.paidAt,
    message: submittedSettlementMessage({
      duplicate: result.duplicate,
      settlementNo: result.settlementNo,
      status: result.status,
      paidAt: result.paidAt,
    }),
  };
}

/** 店家撤回自己的新版草稿。同樣共用伺服器端閘門，不靠 UI 隱藏按鈕保護。 */
export async function withdrawStoreSettlement(input: {
  merchantId: string;
  settlementId: string;
}): Promise<SettlementWriteResult> {
  if (!settlementWriteEnabled()) return settlementWriteFailure('WRITE_DISABLED');
  const { prisma } = await import('@/lib/prisma');
  return withdrawSettlementDraft(prisma, input);
}
