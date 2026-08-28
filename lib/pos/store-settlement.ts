import {
  isIncludedInSettlement,
  netSettlement,
  summarizeStoreLedger,
  type LedgerEntry,
} from '@/lib/pos/store-ledger';

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

export async function persistStoreSettlement(
  _snapshot: StoreSettlementSnapshot,
): Promise<{ ok: false; code: 'SCHEMA_MISSING'; error: string }> {
  return {
    ok: false,
    code: 'SCHEMA_MISSING',
    error: STORE_SETTLEMENT_SCHEMA_MISSING,
  };
}
