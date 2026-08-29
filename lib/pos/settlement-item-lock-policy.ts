/**
 * SettlementItem 來源鎖定／草稿取消政策（純函式）。
 *
 * 這不是 persistence，也不呼叫 store-settlement 的 transaction abstraction。
 * identity 固定為 canonical sourceKind + sourceId。
 */

import {
  canTransitionSettlement,
  parseSettlementStatus,
  type SettlementStatus,
} from '@/lib/pos/domain-contract';
import {
  LEDGER_UI_SOURCE_KIND_TO_PERSISTENCE,
  SETTLEMENT_ITEM_PERSISTENCE_SOURCE_KINDS,
  type SettlementItemPersistenceSourceKind,
} from '@/lib/pos/settlement-item-mapping';

export type SettlementSourceIdentity = {
  sourceKind: string;
  sourceId: string;
};

export type ExistingSourceLock = {
  sourceKind: string;
  sourceId: string;
  settlementId: string;
  settlementStatus: SettlementStatus;
};

export type VerifiedSettlementLockContext = {
  settlementId: string;
  settlementStatus: SettlementStatus;
};

export type LegacyMerchantStockTxnLockFact = {
  sourceId: string;
  settlementId: string | null;
};

export type SettlementLockFailureCode =
  | 'BATCH_DUPLICATE'
  | 'LOCKED_BY_OTHER'
  | 'FINALIZED_CANNOT_CANCEL'
  | 'NOT_DRAFT_CANCEL'
  | 'LOCK_OWNERSHIP_MISMATCH'
  | 'LEGACY_TXN_LOCK_MISMATCH'
  | 'MIXED_RETRY'
  | 'INVALID_SOURCE_KIND'
  | 'FINALIZED_CANNOT_CLAIM';

export type ClaimSettlementLocksResult =
  | { ok: true; action: 'create'; keys: string[] }
  | { ok: true; action: 'idempotent'; keys: string[] }
  | {
      ok: false;
      code: SettlementLockFailureCode;
      keys: string[];
    };

export type DraftCancelPlanResult =
  | { ok: true; releaseKeys: string[]; nextStatus: 'cancelled' }
  | { ok: false; code: SettlementLockFailureCode; keys: string[] };

export type LegacyLockConsistencyResult =
  | { ok: true; checked: boolean }
  | { ok: false; code: 'LEGACY_TXN_LOCK_MISMATCH' };

const UI_LOCK_IDENTITY_KINDS = new Set<string>([
  ...Object.keys(LEDGER_UI_SOURCE_KIND_TO_PERSISTENCE),
  'unpaid_refill',
]);

const PERSISTENCE_SOURCE_KINDS = new Set<string>(SETTLEMENT_ITEM_PERSISTENCE_SOURCE_KINDS);

function isPersistenceSourceKind(value: string): value is SettlementItemPersistenceSourceKind {
  return PERSISTENCE_SOURCE_KINDS.has(value);
}

function copyIdentity(identity: SettlementSourceIdentity): SettlementSourceIdentity {
  return { sourceKind: identity.sourceKind, sourceId: identity.sourceId };
}

export function settlementSourceKey(identity: SettlementSourceIdentity): string {
  return `${identity.sourceKind}::${identity.sourceId}`;
}

export function isActiveSourceLock(status: SettlementStatus): boolean {
  return status === 'draft' || status === 'reviewing' || status === 'approved' || status === 'paid';
}

export function isFinalizedSettlement(status: SettlementStatus): boolean {
  return status === 'approved' || status === 'paid';
}

export function canCancelDraftSettlement(status: unknown): boolean {
  return canTransitionSettlement(status, 'cancelled') && parseSettlementStatus(status) === 'draft';
}

function parseContext(context: VerifiedSettlementLockContext): VerifiedSettlementLockContext {
  return {
    settlementId: context.settlementId,
    settlementStatus: parseSettlementStatus(context.settlementStatus),
  };
}

function validateIdentity(identity: SettlementSourceIdentity): SettlementLockFailureCode | null {
  const sourceKind = identity.sourceKind.trim();
  const sourceId = identity.sourceId.trim();
  if (!sourceKind || !sourceId) return 'INVALID_SOURCE_KIND';
  if (UI_LOCK_IDENTITY_KINDS.has(sourceKind) || !isPersistenceSourceKind(sourceKind)) {
    return 'INVALID_SOURCE_KIND';
  }
  return null;
}

export function findDuplicateSourceIdentities(
  requested: readonly SettlementSourceIdentity[],
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const identity of requested) {
    const key = settlementSourceKey(identity);
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }
  return [...duplicates];
}

function indexActiveLocks(
  existingLocks: readonly ExistingSourceLock[],
): Map<string, ExistingSourceLock> | { ok: false; code: 'LOCK_OWNERSHIP_MISMATCH'; keys: string[] } {
  const byKey = new Map<string, ExistingSourceLock>();
  for (const lock of existingLocks) {
    const status = parseSettlementStatus(lock.settlementStatus);
    if (!isActiveSourceLock(status)) continue;
    const key = settlementSourceKey(lock);
    const current = byKey.get(key);
    if (current && current.settlementId !== lock.settlementId) {
      return { ok: false, code: 'LOCK_OWNERSHIP_MISMATCH', keys: [key] };
    }
    byKey.set(key, {
      sourceKind: lock.sourceKind,
      sourceId: lock.sourceId,
      settlementId: lock.settlementId,
      settlementStatus: status,
    });
  }
  return byKey;
}

/**
 * 決定一批來源是否可鎖定到目前 settlement。
 * 部分衝突一律整批失敗。mixed retry（自己已持有 + 全新來源）fail closed。
 */
export function claimSettlementSourceLocks(input: {
  context: VerifiedSettlementLockContext;
  requested: readonly SettlementSourceIdentity[];
  existingLocks: readonly ExistingSourceLock[];
}): ClaimSettlementLocksResult {
  const context = parseContext(input.context);
  const requested = input.requested.map(copyIdentity);
  const keys = requested.map(settlementSourceKey);

  for (const identity of requested) {
    const invalid = validateIdentity(identity);
    if (invalid) {
      return { ok: false, code: invalid, keys };
    }
  }

  const duplicates = findDuplicateSourceIdentities(requested);
  if (duplicates.length > 0) {
    return { ok: false, code: 'BATCH_DUPLICATE', keys: duplicates };
  }

  const indexed = indexActiveLocks(input.existingLocks);
  if (!(indexed instanceof Map)) return indexed;

  const ownedKeys: string[] = [];
  const newKeys: string[] = [];
  const foreignKeys: string[] = [];
  const mismatchKeys: string[] = [];

  for (const identity of requested) {
    const key = settlementSourceKey(identity);
    const lock = indexed.get(key);
    if (!lock) {
      newKeys.push(key);
      continue;
    }
    if (lock.settlementId !== context.settlementId) {
      foreignKeys.push(key);
      continue;
    }
    if (lock.settlementStatus !== context.settlementStatus) {
      mismatchKeys.push(key);
      continue;
    }
    ownedKeys.push(key);
  }

  if (mismatchKeys.length > 0) {
    return { ok: false, code: 'LOCK_OWNERSHIP_MISMATCH', keys: mismatchKeys };
  }
  if (foreignKeys.length > 0) {
    return { ok: false, code: 'LOCKED_BY_OTHER', keys };
  }
  if (ownedKeys.length > 0 && newKeys.length > 0) {
    return { ok: false, code: 'MIXED_RETRY', keys };
  }
  if (ownedKeys.length === requested.length && requested.length > 0) {
    return { ok: true, action: 'idempotent', keys };
  }
  if (context.settlementStatus !== 'draft') {
    return { ok: false, code: 'FINALIZED_CANNOT_CLAIM', keys };
  }
  return { ok: true, action: 'create', keys };
}

export function planDraftSettlementCancellation(input: {
  context: VerifiedSettlementLockContext;
  existingLocks: readonly ExistingSourceLock[];
  legacyTxnLocks?: readonly LegacyMerchantStockTxnLockFact[];
}): DraftCancelPlanResult {
  const context = parseContext(input.context);
  const ownLocks = input.existingLocks.filter((lock) => lock.settlementId === context.settlementId);
  const foreignLocks = input.existingLocks.filter((lock) => lock.settlementId !== context.settlementId);
  const ownKeys = ownLocks.map(settlementSourceKey);
  void foreignLocks;

  if (isFinalizedSettlement(context.settlementStatus) || context.settlementStatus === 'cancelled') {
    return { ok: false, code: 'FINALIZED_CANNOT_CANCEL', keys: ownKeys };
  }
  if (!canCancelDraftSettlement(context.settlementStatus)) {
    return { ok: false, code: 'NOT_DRAFT_CANCEL', keys: ownKeys };
  }

  for (const lock of ownLocks) {
    const status = parseSettlementStatus(lock.settlementStatus);
    if (status !== 'draft' || lock.settlementId !== context.settlementId) {
      return { ok: false, code: 'LOCK_OWNERSHIP_MISMATCH', keys: [settlementSourceKey(lock)] };
    }
  }

  const legacyBySourceId = new Map(
    (input.legacyTxnLocks ?? []).map((row) => [row.sourceId, row.settlementId] as const),
  );
  for (const lock of ownLocks) {
    if (lock.sourceKind !== 'merchant_stock_txn') continue;
    const consistency = checkMerchantStockTxnLockConsistency({
      identity: lock,
      itemLock: lock,
      legacySettlementId: legacyBySourceId.get(lock.sourceId) ?? null,
    });
    if (!consistency.ok) {
      return { ok: false, code: 'LEGACY_TXN_LOCK_MISMATCH', keys: [settlementSourceKey(lock)] };
    }
  }

  return {
    ok: true,
    releaseKeys: ownKeys,
    nextStatus: 'cancelled',
  };
}

export function checkMerchantStockTxnLockConsistency(input: {
  identity: SettlementSourceIdentity;
  itemLock: ExistingSourceLock | null;
  legacySettlementId: string | null;
}): LegacyLockConsistencyResult {
  if (input.identity.sourceKind !== 'merchant_stock_txn') {
    return { ok: true, checked: false };
  }
  const itemSettlementId = input.itemLock?.settlementId ?? null;
  const legacySettlementId = input.legacySettlementId;
  if (itemSettlementId == null && legacySettlementId == null) {
    return { ok: true, checked: true };
  }
  if (itemSettlementId != null && legacySettlementId != null && itemSettlementId === legacySettlementId) {
    return { ok: true, checked: true };
  }
  return { ok: false, code: 'LEGACY_TXN_LOCK_MISMATCH' };
}
