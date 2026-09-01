import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  authoritativeGroomingCouponStoreIds,
  couponRowBelongsToMerchant,
  projectSubsidyFactsToLedgerEntries,
  resolveGroomingCouponMerchantScope,
  type GroomingCouponSourceRow,
  type StoreLedgerMerchantContext,
  type StoreLedgerStoreContext,
} from '@/lib/pos/project-store-ledger-sources';
import { mapLedgerEntriesToSettlementItemDrafts } from '@/lib/pos/settlement-item-mapping';

const MERCHANT: StoreLedgerMerchantContext = {
  id: 'cuid-merchant-paopao',
  merchantId: 'MER-0001',
  name: '泡泡堂中和店',
};
const OTHER: StoreLedgerMerchantContext = {
  id: 'cuid-merchant-other',
  merchantId: 'MER-0002',
  name: '泡泡堂中和店',
};
const STORE: StoreLedgerStoreContext = {
  id: 'cuid-store-paopao',
  slug: 'mer_0001',
};
const OTHER_STORE: StoreLedgerStoreContext = {
  id: 'cuid-store-other',
  slug: 'mer_0002',
};
const SCOPE = { merchantId: MERCHANT.id };
const at = (stamp: string) => new Date(`${stamp}+08:00`);

function coupon(overrides: Partial<GroomingCouponSourceRow> = {}): GroomingCouponSourceRow {
  return {
    id: 'grooming-coupon-row',
    couponCode: 'PT10-200',
    discountAmount: 200,
    redeemedAt: at('2024-05-19T15:00:00'),
    customerId: 'cust-wang',
    storeId: STORE.slug,
    storeName: MERCHANT.name,
    customer: { id: 'cust-wang', name: '王小姐' },
    ...overrides,
  };
}

describe('grooming coupon merchant scope resolver', () => {
  it('includes coupons whose storeId is Merchant.id', () => {
    assert.equal(
      resolveGroomingCouponMerchantScope(coupon({ storeId: MERCHANT.id }), MERCHANT, STORE),
      'owned',
    );
  });

  it('includes coupons whose storeId is Merchant.merchantId', () => {
    assert.equal(
      resolveGroomingCouponMerchantScope(coupon({ storeId: MERCHANT.merchantId }), MERCHANT, STORE),
      'owned',
    );
  });

  it('includes coupons whose storeId is the matching Store.id', () => {
    assert.equal(
      resolveGroomingCouponMerchantScope(coupon({ storeId: STORE.id! }), MERCHANT, STORE),
      'owned',
    );
  });

  it('includes coupons whose storeId is the matching Store slug', () => {
    assert.equal(
      resolveGroomingCouponMerchantScope(coupon({ storeId: STORE.slug }), MERCHANT, STORE),
      'owned',
    );
  });

  it('excludes name-only coupons even when storeName matches the current merchant', () => {
    const nameOnly = coupon({ id: 'name-only', storeId: '', storeName: MERCHANT.name });
    assert.equal(resolveGroomingCouponMerchantScope(nameOnly, MERCHANT, STORE), 'unresolved');
    assert.equal(couponRowBelongsToMerchant(nameOnly, MERCHANT, STORE), false);
    const entries = projectSubsidyFactsToLedgerEntries({
      merchant: MERCHANT,
      store: STORE,
      coupons: [nameOnly],
      redemptions: [],
    });
    assert.equal(entries.length, 0);
    assert.equal(mapLedgerEntriesToSettlementItemDrafts(entries, SCOPE).length, 0);
  });

  it('does not assign a same-name merchant coupon to the signed-in merchant', () => {
    const otherCoupon = coupon({
      id: 'other-same-name',
      storeId: OTHER.id,
      storeName: MERCHANT.name,
    });
    assert.equal(MERCHANT.name, OTHER.name);
    assert.equal(resolveGroomingCouponMerchantScope(otherCoupon, MERCHANT, STORE), 'foreign');
    assert.equal(resolveGroomingCouponMerchantScope(otherCoupon, OTHER, OTHER_STORE), 'owned');
    const entries = projectSubsidyFactsToLedgerEntries({
      merchant: MERCHANT,
      store: STORE,
      coupons: [otherCoupon],
      redemptions: [],
    });
    assert.equal(entries.length, 0);
    assert.equal(mapLedgerEntriesToSettlementItemDrafts(entries, SCOPE).length, 0);
  });

  it('excludes coupons whose storeId belongs to another merchant', () => {
    const foreign = coupon({ id: 'foreign', storeId: OTHER.merchantId, storeName: OTHER.name });
    assert.equal(resolveGroomingCouponMerchantScope(foreign, MERCHANT, STORE), 'foreign');
    const entries = projectSubsidyFactsToLedgerEntries({
      merchant: MERCHANT,
      store: STORE,
      coupons: [foreign],
      redemptions: [],
    });
    assert.equal(entries.some((entry) => entry.sourceId === 'foreign'), false);
    assert.equal(mapLedgerEntriesToSettlementItemDrafts(entries, SCOPE).length, 0);
  });

  it('excludes empty or unknown legacy storeId values', () => {
    const empty = coupon({ id: 'empty', storeId: '   ', storeName: MERCHANT.name });
    const unknown = coupon({ id: 'unknown', storeId: 'legacy-unknown', storeName: MERCHANT.name });
    assert.equal(resolveGroomingCouponMerchantScope(empty, MERCHANT, STORE), 'unresolved');
    assert.equal(resolveGroomingCouponMerchantScope(unknown, MERCHANT, STORE), 'foreign');
    const entries = projectSubsidyFactsToLedgerEntries({
      merchant: MERCHANT,
      store: STORE,
      coupons: [empty, unknown],
      redemptions: [],
    });
    assert.equal(entries.length, 0);
    assert.equal(mapLedgerEntriesToSettlementItemDrafts(entries, SCOPE).length, 0);
  });

  it('normalizes owned coupon ledger.storeId to canonical Merchant.id', () => {
    const entries = projectSubsidyFactsToLedgerEntries({
      merchant: MERCHANT,
      store: STORE,
      coupons: [coupon({ storeId: STORE.slug })],
      redemptions: [],
    });
    assert.equal(entries[0]?.storeId, MERCHANT.id);
    const items = mapLedgerEntriesToSettlementItemDrafts(entries, SCOPE);
    assert.equal(items[0]?.merchantId, MERCHANT.id);
  });

  it('does not put merchant names into authoritative storeId aliases', () => {
    const aliases = authoritativeGroomingCouponStoreIds(MERCHANT, STORE);
    assert.deepEqual(aliases.sort(), [MERCHANT.id, MERCHANT.merchantId, STORE.id, STORE.slug].sort());
    assert.equal(aliases.includes(MERCHANT.name), false);
  });
});
