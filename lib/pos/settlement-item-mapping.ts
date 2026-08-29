/**
 * SettlementItem 對應層（純函式）。
 *
 * 把伺服器已分類的 POS ledger fact，轉成尚未落庫的 SettlementItem draft。
 * 不讀寫資料庫、不 import Prisma、不採用 client 覆寫。
 *
 * 這不是第二套付款／履約狀態機，也不是 persistence。
 * 既有 store-settlement snapshot 仍只負責畫面合計；正式 identity 以本檔為準。
 */

import {
  assertPositiveTwdInteger,
  assertValidDate,
} from '@/lib/pos/domain-contract';
import {
  toNtd,
  type FundDirection,
  type LedgerEntry,
  type PaymentCollector,
} from '@/lib/pos/store-ledger';

export const SETTLEMENT_ITEM_PERSISTENCE_SOURCE_KINDS = [
  'merchant_stock_txn',
  'payment_order',
  'restock_request',
  'grooming_coupon',
  'reward_redemption',
  'adjustment',
  'reversal',
] as const;
export type SettlementItemPersistenceSourceKind =
  (typeof SETTLEMENT_ITEM_PERSISTENCE_SOURCE_KINDS)[number];

export const SETTLEMENT_ITEM_DIRECTIONS = ['STORE_TO_FURMOSA', 'FURMOSA_TO_STORE'] as const;
export type SettlementItemDirection = (typeof SETTLEMENT_ITEM_DIRECTIONS)[number];

/** UI ledger sourceKind → persistence sourceKind。未列出的名稱不得寫入 identity。 */
export const LEDGER_UI_SOURCE_KIND_TO_PERSISTENCE = {
  payment: 'payment_order',
  restock: 'restock_request',
  coupon: 'grooming_coupon',
  reward: 'reward_redemption',
} as const satisfies Record<string, SettlementItemPersistenceSourceKind>;

export type LedgerUiSourceKindThatPersists = keyof typeof LEDGER_UI_SOURCE_KIND_TO_PERSISTENCE;

/** 目前 POS ledger 有這些 UI 名稱，但 v1 不建立 SettlementItem identity。 */
export const LEDGER_UI_SOURCE_KINDS_EXCLUDED_FROM_PERSISTENCE = [
  'unpaid_refill',
  'adjustment',
] as const;

export type VerifiedMerchantScope = {
  merchantId: string;
};

/**
 * Client 可能試圖覆寫的欄位。mapping 必須完全忽略，不得讀取作為結果。
 */
export type ClientSettlementOverrides = {
  merchantId?: unknown;
  amountTwd?: unknown;
  amount?: unknown;
  direction?: unknown;
  collector?: unknown;
  kind?: unknown;
  sourceKind?: unknown;
  inclusion?: unknown;
  included?: unknown;
  storeId?: unknown;
  relatedOrderId?: unknown;
  description?: unknown;
};

export type SettlementItemDraft = {
  merchantId: string;
  sourceKind: SettlementItemPersistenceSourceKind;
  sourceId: string;
  occurredAt: Date;
  amountTwd: number;
  direction: SettlementItemDirection;
  collector: PaymentCollector;
  kind: LedgerEntry['transactionType'];
  relatedOrderId: string | null;
  description: string | null;
};

export class MerchantScopeMismatchError extends Error {
  readonly code = 'MERCHANT_SCOPE_MISMATCH' as const;
  constructor(
    readonly scopeMerchantId: string,
    readonly factStoreId: string,
  ) {
    super('這筆流水不屬於目前店家，不能寫進這次結算');
    this.name = 'MerchantScopeMismatchError';
  }
}

export class InvalidMerchantScopeError extends Error {
  readonly code = 'INVALID_MERCHANT_SCOPE' as const;
  constructor() {
    super('結算必須使用伺服器已驗證的店家');
    this.name = 'InvalidMerchantScopeError';
  }
}

export function toCanonicalSettlementSourceKind(
  ledgerSourceKind: LedgerEntry['sourceKind'],
): SettlementItemPersistenceSourceKind | null {
  if (ledgerSourceKind === 'unpaid_refill' || ledgerSourceKind === 'adjustment') {
    return null;
  }
  if (ledgerSourceKind in LEDGER_UI_SOURCE_KIND_TO_PERSISTENCE) {
    return LEDGER_UI_SOURCE_KIND_TO_PERSISTENCE[ledgerSourceKind as LedgerUiSourceKindThatPersists];
  }
  return null;
}

function isPersistableDirection(value: FundDirection): value is SettlementItemDirection {
  return value === 'STORE_TO_FURMOSA' || value === 'FURMOSA_TO_STORE';
}

function snapshotDescription(entry: LedgerEntry): string | null {
  const remark = entry.remark?.trim();
  if (remark) return remark;
  const content = entry.content.trim();
  return content || null;
}

function requireVerifiedMerchantId(scope: VerifiedMerchantScope): string {
  const merchantId = typeof scope.merchantId === 'string' ? scope.merchantId.trim() : '';
  if (!merchantId) {
    throw new InvalidMerchantScopeError();
  }
  return merchantId;
}

/**
 * 將一筆已分類 ledger fact 轉成 SettlementItem draft。
 * clientOverrides 若傳入，一律忽略。
 */
export function mapLedgerEntryToSettlementItemDraft(
  entry: LedgerEntry,
  scope: VerifiedMerchantScope,
  clientOverrides?: ClientSettlementOverrides | null,
): SettlementItemDraft | null {
  void clientOverrides;
  const merchantId = requireVerifiedMerchantId(scope);
  if (entry.storeId !== merchantId) {
    throw new MerchantScopeMismatchError(merchantId, entry.storeId);
  }

  if (entry.fundDirection === 'NO_SETTLEMENT') return null;
  if (entry.settlementStatus === 'SETTLED' || entry.settlementStatus === 'EXCLUDED') return null;
  if (entry.settlementStatus !== 'UNSETTLED') return null;
  if (!isPersistableDirection(entry.fundDirection)) return null;

  // v1 unique 是 (sourceKind, sourceId)。沖銷與原補貼會撞同一 identity，不能在此發明 sourceSubKey。
  if (entry.transactionType === 'COUPON_REVERSAL') return null;

  const sourceKind = toCanonicalSettlementSourceKind(entry.sourceKind);
  if (!sourceKind) return null;

  const amountTwd = toNtd(entry.amount);
  if (amountTwd <= 0) return null;
  assertPositiveTwdInteger(amountTwd, '結算金額');
  assertValidDate(entry.occurredAt, '發生時間');

  return {
    merchantId,
    sourceKind,
    sourceId: entry.sourceId,
    occurredAt: new Date(entry.occurredAt.getTime()),
    amountTwd,
    direction: entry.fundDirection,
    collector: entry.paymentCollector,
    kind: entry.transactionType,
    relatedOrderId: entry.relatedOrderId,
    description: snapshotDescription(entry),
  };
}

export function mapLedgerEntriesToSettlementItemDrafts(
  entries: readonly LedgerEntry[],
  scope: VerifiedMerchantScope,
  clientOverrides?: ClientSettlementOverrides | null,
): SettlementItemDraft[] {
  const items: SettlementItemDraft[] = [];
  for (const entry of entries) {
    const item = mapLedgerEntryToSettlementItemDraft(entry, scope, clientOverrides);
    if (item) items.push(item);
  }
  return items;
}
