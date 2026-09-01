import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  claimSettlementSourceLocks,
  checkMerchantStockTxnLockConsistency,
  findDuplicateSourceIdentities,
  planDraftSettlementCancellation,
  settlementSourceKey,
  type ExistingSourceLock,
  type SettlementSourceIdentity,
} from '@/lib/pos/settlement-item-lock-policy';

const DRAFT = {
  settlementId: 'st-draft-1',
  settlementStatus: 'draft' as const,
};

function source(
  sourceKind: string,
  sourceId: string,
): SettlementSourceIdentity {
  return { sourceKind, sourceId };
}

function lock(
  identity: SettlementSourceIdentity,
  settlementId: string,
  settlementStatus: ExistingSourceLock['settlementStatus'],
): ExistingSourceLock {
  return {
    ...identity,
    settlementId,
    settlementStatus,
  };
}

const PAYMENT = source('payment_order', 'pay-1');
const COUPON = source('grooming_coupon', 'cpn-1');
const RESTOCK = source('restock_request', 'rst-1');
const MST = source('merchant_stock_txn', 'txn-1');

describe('settlement item lock policy', () => {
  it('does not treat the same sourceId as a duplicate across different sourceKinds', () => {
    const requested = [source('payment_order', 'shared-id'), source('grooming_coupon', 'shared-id')];
    assert.deepEqual(findDuplicateSourceIdentities(requested), []);
    const result = claimSettlementSourceLocks({
      context: DRAFT,
      requested,
      existingLocks: [],
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.action, 'create');
  });

  it('treats the same sourceKind and sourceId as one source', () => {
    assert.equal(
      settlementSourceKey(source('payment_order', 'pay-1')),
      settlementSourceKey(source('payment_order', 'pay-1')),
    );
    assert.deepEqual(findDuplicateSourceIdentities([PAYMENT, source('payment_order', 'pay-1')]), [
      'payment_order::pay-1',
    ]);
  });

  it('rejects a whole batch when the same identity appears twice', () => {
    const requested = [PAYMENT, COUPON, source('payment_order', 'pay-1')];
    const before = structuredClone(requested);
    const result = claimSettlementSourceLocks({
      context: DRAFT,
      requested,
      existingLocks: [],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'BATCH_DUPLICATE');
    assert.deepEqual(requested, before);
  });

  it('rejects a whole batch when a source is locked by another draft settlement', () => {
    const requested = [PAYMENT, COUPON];
    const result = claimSettlementSourceLocks({
      context: DRAFT,
      requested,
      existingLocks: [lock(PAYMENT, 'st-other', 'draft')],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'LOCKED_BY_OTHER');
      assert.equal(result.keys.includes('grooming_coupon::cpn-1'), true);
    }
  });

  it('rejects a source locked by an approved settlement', () => {
    const result = claimSettlementSourceLocks({
      context: DRAFT,
      requested: [PAYMENT],
      existingLocks: [lock(PAYMENT, 'st-approved', 'approved')],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'LOCKED_BY_OTHER');
  });

  it('rejects a paid lock and does not allow changing it', () => {
    const result = claimSettlementSourceLocks({
      context: DRAFT,
      requested: [PAYMENT],
      existingLocks: [lock(PAYMENT, 'st-paid', 'paid')],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'LOCKED_BY_OTHER');
    const cancelPaid = planDraftSettlementCancellation({
      context: { settlementId: 'st-paid', settlementStatus: 'paid' },
      existingLocks: [lock(PAYMENT, 'st-paid', 'paid')],
    });
    assert.equal(cancelPaid.ok, false);
    if (!cancelPaid.ok) assert.equal(cancelPaid.code, 'FINALIZED_CANNOT_CANCEL');
  });

  it('returns idempotent when every source is already owned by the same draft settlement', () => {
    const requested = [PAYMENT, COUPON];
    const result = claimSettlementSourceLocks({
      context: DRAFT,
      requested,
      existingLocks: [lock(PAYMENT, DRAFT.settlementId, 'draft'), lock(COUPON, DRAFT.settlementId, 'draft')],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.action, 'idempotent');
      assert.deepEqual(result.keys, ['payment_order::pay-1', 'grooming_coupon::cpn-1']);
    }
  });

  it('fail-closes mixed retry of owned sources plus new sources', () => {
    const result = claimSettlementSourceLocks({
      context: DRAFT,
      requested: [PAYMENT, RESTOCK],
      existingLocks: [lock(PAYMENT, DRAFT.settlementId, 'draft')],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'MIXED_RETRY');
  });

  it('does not partially accept a batch when one source is locked by someone else', () => {
    const result = claimSettlementSourceLocks({
      context: DRAFT,
      requested: [PAYMENT, COUPON, RESTOCK],
      existingLocks: [lock(COUPON, 'st-other', 'draft')],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'LOCKED_BY_OTHER');
      assert.deepEqual(result.keys, [
        'payment_order::pay-1',
        'grooming_coupon::cpn-1',
        'restock_request::rst-1',
      ]);
    }
  });

  it('allows cancelling a draft settlement', () => {
    const result = planDraftSettlementCancellation({
      context: DRAFT,
      existingLocks: [lock(PAYMENT, DRAFT.settlementId, 'draft'), lock(COUPON, DRAFT.settlementId, 'draft')],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.nextStatus, 'cancelled');
      assert.deepEqual(result.releaseKeys, ['payment_order::pay-1', 'grooming_coupon::cpn-1']);
    }
  });

  it('does not allow draft-cancel on a reviewing settlement', () => {
    const result = planDraftSettlementCancellation({
      context: { settlementId: 'st-rev', settlementStatus: 'reviewing' },
      existingLocks: [lock(PAYMENT, 'st-rev', 'reviewing')],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'NOT_DRAFT_CANCEL');
  });

  it('does not allow draft-cancel on an approved settlement', () => {
    const result = planDraftSettlementCancellation({
      context: { settlementId: 'st-appr', settlementStatus: 'approved' },
      existingLocks: [lock(PAYMENT, 'st-appr', 'approved')],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'FINALIZED_CANNOT_CANCEL');
  });

  it('does not cancel or release locks for a paid settlement', () => {
    const result = planDraftSettlementCancellation({
      context: { settlementId: 'st-paid', settlementStatus: 'paid' },
      existingLocks: [lock(PAYMENT, 'st-paid', 'paid')],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'FINALIZED_CANNOT_CANCEL');
  });

  it('releases only the cancelled draft settlement’s own locks', () => {
    const result = planDraftSettlementCancellation({
      context: DRAFT,
      existingLocks: [
        lock(PAYMENT, DRAFT.settlementId, 'draft'),
        lock(COUPON, 'st-other', 'draft'),
      ],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.releaseKeys, ['payment_order::pay-1']);
      assert.equal(result.releaseKeys.includes('grooming_coupon::cpn-1'), false);
    }
  });

  it('does not release another settlement’s locks when cancelling a draft', () => {
    const other = lock(RESTOCK, 'st-other', 'draft');
    const before = structuredClone(other);
    const result = planDraftSettlementCancellation({
      context: DRAFT,
      existingLocks: [lock(PAYMENT, DRAFT.settlementId, 'draft'), other],
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.releaseKeys.includes(settlementSourceKey(RESTOCK)), false);
    assert.deepEqual(other, before);
  });

  it('rejects when a lock owner does not match the settlement snapshot', () => {
    const result = planDraftSettlementCancellation({
      context: DRAFT,
      existingLocks: [lock(PAYMENT, DRAFT.settlementId, 'paid')],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'LOCK_OWNERSHIP_MISMATCH');
  });

  it('does not mutate requested sources or existing locks', () => {
    const requested = [PAYMENT, COUPON];
    const existingLocks = [lock(PAYMENT, 'st-other', 'draft')];
    const requestedBefore = structuredClone(requested);
    const locksBefore = structuredClone(existingLocks);
    claimSettlementSourceLocks({ context: DRAFT, requested, existingLocks });
    planDraftSettlementCancellation({
      context: DRAFT,
      existingLocks: [lock(COUPON, DRAFT.settlementId, 'draft'), existingLocks[0]!],
    });
    assert.deepEqual(requested, requestedBefore);
    assert.deepEqual(existingLocks, locksBefore);
  });

  it('treats MerchantStockTxn as consistent when neither side is locked', () => {
    const result = checkMerchantStockTxnLockConsistency({
      identity: MST,
      itemLock: null,
      legacySettlementId: null,
    });
    assert.deepEqual(result, { ok: true, checked: true });
  });

  it('treats MerchantStockTxn as consistent when both locks point at the same settlement', () => {
    const result = checkMerchantStockTxnLockConsistency({
      identity: MST,
      itemLock: lock(MST, 'st-1', 'draft'),
      legacySettlementId: 'st-1',
    });
    assert.deepEqual(result, { ok: true, checked: true });
  });

  it('treats MerchantStockTxn as inconsistent when only the SettlementItem lock exists', () => {
    const result = checkMerchantStockTxnLockConsistency({
      identity: MST,
      itemLock: lock(MST, 'st-1', 'draft'),
      legacySettlementId: null,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'LEGACY_TXN_LOCK_MISMATCH');
  });

  it('treats MerchantStockTxn as inconsistent when only the legacy lock exists', () => {
    const result = checkMerchantStockTxnLockConsistency({
      identity: MST,
      itemLock: null,
      legacySettlementId: 'st-1',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'LEGACY_TXN_LOCK_MISMATCH');
  });

  it('treats MerchantStockTxn as inconsistent when the two settlement ids differ', () => {
    const result = checkMerchantStockTxnLockConsistency({
      identity: MST,
      itemLock: lock(MST, 'st-item', 'draft'),
      legacySettlementId: 'st-legacy',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'LEGACY_TXN_LOCK_MISMATCH');
  });

  it('does not apply MerchantStockTxn legacy lock rules to other source kinds', () => {
    const result = checkMerchantStockTxnLockConsistency({
      identity: PAYMENT,
      itemLock: lock(PAYMENT, 'st-1', 'draft'),
      legacySettlementId: null,
    });
    assert.deepEqual(result, { ok: true, checked: false });
  });

  it('does not use UI payment/coupon names as canonical lock identity', () => {
    assert.equal(settlementSourceKey(PAYMENT), 'payment_order::pay-1');
    assert.equal(settlementSourceKey(COUPON), 'grooming_coupon::cpn-1');
    const uiPayment = claimSettlementSourceLocks({
      context: DRAFT,
      requested: [source('payment', 'pay-1')],
      existingLocks: [],
    });
    const uiCoupon = claimSettlementSourceLocks({
      context: DRAFT,
      requested: [source('coupon', 'cpn-1')],
      existingLocks: [],
    });
    assert.equal(uiPayment.ok, false);
    assert.equal(uiCoupon.ok, false);
    if (!uiPayment.ok) assert.equal(uiPayment.code, 'INVALID_SOURCE_KIND');
    if (!uiCoupon.ok) assert.equal(uiCoupon.code, 'INVALID_SOURCE_KIND');
    assert.notEqual(settlementSourceKey(PAYMENT), 'payment::pay-1');
    assert.notEqual(settlementSourceKey(COUPON), 'coupon::cpn-1');
  });

  it('does not treat adjustment as a MerchantStockTxn legacy lock', () => {
    const adjustment = source('adjustment', 'adj-1');
    const result = checkMerchantStockTxnLockConsistency({
      identity: adjustment,
      itemLock: null,
      legacySettlementId: 'st-1',
    });
    assert.deepEqual(result, { ok: true, checked: false });
  });
});
