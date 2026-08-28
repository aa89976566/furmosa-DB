import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  couponRowBelongsToMerchant,
  projectSubsidyFactsToLedgerEntries,
  type GroomingCouponSourceRow,
  type RewardRedemptionSourceRow,
  type StoreLedgerMerchantContext,
  type StoreLedgerStoreContext,
} from '@/lib/pos/project-store-ledger-sources';
import {
  MerchantScopeMismatchError,
  mapLedgerEntriesToSettlementItemDrafts,
  mapLedgerEntryToSettlementItemDraft,
} from '@/lib/pos/settlement-item-mapping';

const MERCHANT: StoreLedgerMerchantContext = {
  id: 'cuid-merchant-paopao',
  merchantId: 'MER-0001',
  name: '泡泡堂中和店',
};
const STORE: StoreLedgerStoreContext = {
  id: 'cuid-store-paopao',
  slug: 'mer_0001',
};
const SCOPE = { merchantId: MERCHANT.id };
const at = (stamp: string) => new Date(`${stamp}+08:00`);

function couponRow(overrides: Partial<GroomingCouponSourceRow> = {}): GroomingCouponSourceRow {
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

function redemptionRow(
  overrides: Partial<RewardRedemptionSourceRow> = {},
): RewardRedemptionSourceRow {
  return {
    id: 'reward-redemption-row',
    couponCode: 'RWD-200',
    usedAt: at('2024-05-19T16:00:00'),
    customerId: 'cust-wang',
    partnerMerchantId: MERCHANT.id,
    customer: { id: 'cust-wang', name: '王小姐' },
    reward: { couponFaceValue: 200 },
    ...overrides,
  };
}

function project(input?: {
  coupons?: GroomingCouponSourceRow[];
  redemptions?: RewardRedemptionSourceRow[];
  merchant?: StoreLedgerMerchantContext;
  store?: StoreLedgerStoreContext;
}) {
  return projectSubsidyFactsToLedgerEntries({
    merchant: input?.merchant ?? MERCHANT,
    store: input?.store ?? STORE,
    coupons: input?.coupons ?? [],
    redemptions: input?.redemptions ?? [],
  });
}

describe('store ledger subsidy projection → SettlementItem draft', () => {
  it('maps a loaded RewardRedemption to reward_redemption using the redemption row id', () => {
    const entries = project({ redemptions: [redemptionRow()] });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.sourceKind, 'reward');
    assert.equal(entries[0]?.sourceId, 'reward-redemption-row');
    assert.notEqual(entries[0]?.sourceKind, 'coupon');
    assert.notEqual(entries[0]?.sourceId, 'RWD-200');

    const items = mapLedgerEntriesToSettlementItemDrafts(entries, SCOPE);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.sourceKind, 'reward_redemption');
    assert.equal(items[0]?.sourceId, 'reward-redemption-row');
    assert.equal(items[0]?.direction, 'FURMOSA_TO_STORE');
    assert.notEqual(items[0]?.sourceKind, 'grooming_coupon');
  });

  it('maps a loaded GroomingCoupon to grooming_coupon using the coupon row id', () => {
    const entries = project({ coupons: [couponRow()] });
    assert.equal(entries[0]?.sourceKind, 'coupon');
    assert.equal(entries[0]?.sourceId, 'grooming-coupon-row');
    assert.notEqual(entries[0]?.sourceId, 'PT10-200');
    assert.equal(entries[0]?.storeId, MERCHANT.id);

    const items = mapLedgerEntriesToSettlementItemDrafts(entries, SCOPE);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.sourceKind, 'grooming_coupon');
    assert.equal(items[0]?.sourceId, 'grooming-coupon-row');
    assert.equal(items[0]?.merchantId, MERCHANT.id);
  });

  it('does not let the shared coupon classifier downgrade RewardRedemption to coupon', () => {
    const entries = project({ redemptions: [redemptionRow({ couponCode: 'PT10-200' })] });
    assert.equal(entries[0]?.sourceKind, 'reward');
    assert.equal(entries[0]?.id.startsWith('reward:'), true);
    const item = mapLedgerEntryToSettlementItemDraft(entries[0]!, SCOPE)!;
    assert.equal(item.sourceKind, 'reward_redemption');
  });

  it('writes canonical Merchant.id onto coupon ledger entries even when legacy storeId is a slug', () => {
    const entries = project({ coupons: [couponRow({ storeId: STORE.slug })] });
    assert.equal(entries[0]?.storeId, MERCHANT.id);
    assert.notEqual(entries[0]?.storeId, STORE.slug);
    const item = mapLedgerEntryToSettlementItemDraft(entries[0]!, SCOPE)!;
    assert.equal(item.merchantId, MERCHANT.id);
  });

  it('keeps canonical Merchant.id when legacy coupon storeId is merchant code or Store.id', () => {
    const byMerchantCode = project({
      coupons: [couponRow({ id: 'c-code', storeId: MERCHANT.merchantId })],
    });
    const byStoreId = project({
      coupons: [couponRow({ id: 'c-store', storeId: STORE.id! })],
    });
    assert.equal(byMerchantCode[0]?.storeId, MERCHANT.id);
    assert.equal(byStoreId[0]?.storeId, MERCHANT.id);
    assert.equal(mapLedgerEntryToSettlementItemDraft(byMerchantCode[0]!, SCOPE)?.merchantId, MERCHANT.id);
    assert.equal(mapLedgerEntryToSettlementItemDraft(byStoreId[0]!, SCOPE)?.merchantId, MERCHANT.id);
  });

  it('does not load or map a coupon that does not belong to the signed-in merchant', () => {
    const foreign = couponRow({
      id: 'foreign-coupon',
      storeId: 'other-store-id',
      storeName: MERCHANT.name,
    });
    assert.equal(couponRowBelongsToMerchant(foreign, MERCHANT, STORE), false);
    const entries = project({ coupons: [foreign, couponRow()] });
    assert.equal(entries.every((entry) => entry.sourceId !== 'foreign-coupon'), true);
    const items = mapLedgerEntriesToSettlementItemDrafts(entries, SCOPE);
    assert.equal(items.every((item) => item.sourceId !== 'foreign-coupon'), true);
  });

  it('excludes name-only coupons from ledger and SettlementItem drafts', () => {
    const nameOnly = couponRow({
      id: 'name-only-coupon',
      storeId: '',
      storeName: MERCHANT.name,
    });
    const entries = project({ coupons: [nameOnly, couponRow()] });
    assert.equal(entries.some((entry) => entry.sourceId === 'name-only-coupon'), false);
    assert.equal(entries[0]?.sourceId, 'grooming-coupon-row');
    const items = mapLedgerEntriesToSettlementItemDrafts(entries, SCOPE);
    assert.equal(items.some((item) => item.sourceId === 'name-only-coupon'), false);
  });

  it('still rejects a cross-store fact at the mapping guard', () => {
    const entries = project({ coupons: [couponRow()] });
    const smuggled = { ...entries[0]!, storeId: 'cuid-other-merchant' };
    assert.throws(
      () => mapLedgerEntryToSettlementItemDraft(smuggled, SCOPE),
      MerchantScopeMismatchError,
    );
  });

  it('keeps GroomingCoupon as the authoritative subsidy when RewardRedemption is a duplicate projection', () => {
    const entries = project({
      coupons: [couponRow({ couponCode: 'PT10-200' })],
      redemptions: [
        redemptionRow({
          id: 'duplicate-redemption',
          couponCode: 'PT10-200',
        }),
      ],
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.sourceKind, 'coupon');
    assert.equal(entries[0]?.sourceId, 'grooming-coupon-row');
    const items = mapLedgerEntriesToSettlementItemDrafts(entries, SCOPE);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.sourceKind, 'grooming_coupon');
    assert.equal(items[0]?.sourceId, 'grooming-coupon-row');
    assert.equal(items.some((item) => item.sourceKind === 'reward_redemption'), false);
  });

  it('ignores client-looking merchant identifiers when projecting ledger scope', () => {
    const entries = project({
      coupons: [couponRow({ storeId: STORE.slug })],
    });
    const items = mapLedgerEntriesToSettlementItemDrafts(entries, SCOPE, {
      merchantId: 'attacker-merchant',
      storeId: STORE.slug,
      sourceKind: 'grooming_coupon',
    });
    assert.equal(items[0]?.merchantId, MERCHANT.id);
    assert.notEqual(items[0]?.merchantId, STORE.slug);
    assert.notEqual(items[0]?.merchantId, 'attacker-merchant');
  });
});
