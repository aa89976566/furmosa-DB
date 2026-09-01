import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyAdjustment,
  classifyCouponReversal,
  classifyCouponSubsidy,
  classifyPaymentOrder,
  classifyRewardRedemption,
  classifyRestockCost,
  classifyUnpaidRefill,
  type PaidPaymentSource,
} from '@/lib/pos/store-ledger';
import {
  LEDGER_UI_SOURCE_KIND_TO_PERSISTENCE,
  MerchantScopeMismatchError,
  mapLedgerEntriesToSettlementItemDrafts,
  mapLedgerEntryToSettlementItemDraft,
  toCanonicalSettlementSourceKind,
  type ClientSettlementOverrides,
} from '@/lib/pos/settlement-item-mapping';

const MERCHANT_ID = 'merchant-paopao';
const SCOPE = { merchantId: MERCHANT_ID };
const at = (stamp: string) => new Date(`${stamp}+08:00`);

function refillPayment(overrides: Partial<PaidPaymentSource> = {}): PaidPaymentSource {
  return {
    id: 'pay-99',
    purpose: 'refill',
    status: 'paid',
    amount: 99,
    provider: 'ecpay',
    paidAt: at('2024-05-20T14:32:00'),
    createdAt: at('2024-05-20T14:30:00'),
    refillOrderId: 'refill-12',
    refillDisplay: 'RFP-240428-0012',
    refillOrderType: 'exchange',
    customerId: 'cust-wang',
    customerName: '王小姐',
    jarSerial: '38124491',
    storeId: MERCHANT_ID,
    ...overrides,
  };
}

function couponEntry(overrides: Partial<Parameters<typeof classifyCouponSubsidy>[0]> = {}) {
  return classifyCouponSubsidy({
    id: 'cpn-1',
    customerId: 'cust-wang',
    customerName: '王小姐',
    couponId: 'coupon-row-1',
    couponCode: 'PT10-200',
    discountAmount: 200,
    relatedRefillOrderId: 'refill-12',
    relatedRefillDisplay: 'RFP-240428-0012',
    storeId: MERCHANT_ID,
    redeemedAt: at('2024-05-19T15:00:00'),
    ...overrides,
  });
}

function rewardEntry(overrides: Partial<Parameters<typeof classifyRewardRedemption>[0]> = {}) {
  return classifyRewardRedemption({
    id: 'rwd-1',
    customerId: 'cust-wang',
    customerName: '王小姐',
    couponCode: 'RWD-200',
    discountAmount: 200,
    storeId: MERCHANT_ID,
    usedAt: at('2024-05-19T15:00:00'),
    ...overrides,
  });
}

function restockEntry(overrides: Partial<Parameters<typeof classifyRestockCost>[0]> = {}) {
  return classifyRestockCost({
    id: 'restock-1',
    occurredAt: at('2024-05-19T11:15:00'),
    amount: 3450,
    relatedOrderId: 'po-1',
    relatedOrderDisplay: 'PO-240519-003',
    storeId: MERCHANT_ID,
    content: '補貨單 PO-240519-003',
    ...overrides,
  });
}

const CLIENT_OVERRIDES: ClientSettlementOverrides = {
  merchantId: 'attacker-merchant',
  amountTwd: 1,
  amount: 1,
  direction: 'FURMOSA_TO_STORE',
  collector: 'FURMOSA',
  kind: 'REBATE',
  sourceKind: 'merchant_stock_txn',
  inclusion: true,
  included: true,
  storeId: 'attacker-store',
  relatedOrderId: 'forged-order',
  description: 'forged',
};

describe('settlement item mapping', () => {
  it('does not persist Furmosa online paid facts as SettlementItem drafts', () => {
    const refill = classifyPaymentOrder(refillPayment())!;
    const extra = classifyPaymentOrder(
      refillPayment({
        id: 'pay-30-online',
        purpose: 'extra_topup',
        amount: 30,
        provider: 'ecpay',
      }),
    )!;
    assert.equal(refill.fundDirection, 'NO_SETTLEMENT');
    assert.equal(extra.fundDirection, 'NO_SETTLEMENT');
    assert.equal(mapLedgerEntryToSettlementItemDraft(refill, SCOPE), null);
    assert.equal(mapLedgerEntryToSettlementItemDraft(extra, SCOPE), null);
    assert.equal(
      mapLedgerEntryToSettlementItemDraft(refill, SCOPE, { inclusion: true, included: true }),
      null,
    );
  });

  it('maps store-collected paid extra to STORE_TO_FURMOSA with STORE collector', () => {
    const cash = classifyPaymentOrder(
      refillPayment({
        id: 'pay-30-cash',
        purpose: 'extra_topup',
        amount: 30,
        provider: 'cash',
      }),
    )!;
    const item = mapLedgerEntryToSettlementItemDraft(cash, SCOPE)!;
    assert.equal(item.sourceKind, 'payment_order');
    assert.equal(item.sourceId, 'pay-30-cash');
    assert.equal(item.merchantId, MERCHANT_ID);
    assert.equal(item.amountTwd, 30);
    assert.equal(item.direction, 'STORE_TO_FURMOSA');
    assert.equal(item.collector, 'STORE');
    assert.equal(item.kind, 'EMPTY_JAR_SURCHARGE');
    assert.equal(item.relatedOrderId, 'refill-12');
  });

  it('maps grooming coupon subsidy to FURMOSA_TO_STORE', () => {
    const item = mapLedgerEntryToSettlementItemDraft(couponEntry(), SCOPE)!;
    assert.equal(item.sourceKind, 'grooming_coupon');
    assert.equal(item.sourceId, 'cpn-1');
    assert.equal(item.direction, 'FURMOSA_TO_STORE');
    assert.equal(item.collector, 'NONE');
    assert.equal(item.kind, 'COUPON_SUBSIDY');
    assert.equal(item.amountTwd, 200);
  });

  it('maps reward redemption subsidy to FURMOSA_TO_STORE as reward_redemption', () => {
    const item = mapLedgerEntryToSettlementItemDraft(rewardEntry(), SCOPE)!;
    assert.equal(item.sourceKind, 'reward_redemption');
    assert.equal(item.sourceId, 'rwd-1');
    assert.equal(item.direction, 'FURMOSA_TO_STORE');
    assert.equal(item.amountTwd, 200);
    assert.notEqual(item.sourceKind, 'grooming_coupon');
    assert.notEqual(item.sourceKind, 'reward');
  });

  it('does not create an item for pending payment', () => {
    const pending = classifyPaymentOrder(
      refillPayment({ id: 'pay-pending', status: 'pending', paidAt: null }),
    )!;
    assert.equal(pending.settlementStatus, 'EXCLUDED');
    assert.equal(mapLedgerEntryToSettlementItemDraft(pending, SCOPE), null);
  });

  it('does not create an item for failed payment', () => {
    const failed = classifyPaymentOrder(
      refillPayment({ id: 'pay-fail', status: 'failed', paidAt: null }),
    )!;
    assert.equal(mapLedgerEntryToSettlementItemDraft(failed, SCOPE), null);
  });

  it('does not create an item for cancelled payment, including unpaid store-cash extra', () => {
    const cancelledOnline = classifyPaymentOrder(
      refillPayment({ id: 'pay-cancel', status: 'cancelled', paidAt: null }),
    )!;
    const cancelledCashExtra = classifyPaymentOrder(
      refillPayment({
        id: 'pay-30-cash-cancel',
        purpose: 'extra_topup',
        amount: 30,
        provider: 'cash',
        status: 'cancelled',
        paidAt: null,
      }),
    )!;
    const cancelledUnpaid = classifyUnpaidRefill({
      id: 'refill-cancelled',
      createdAt: at('2024-05-18T10:00:00'),
      amount: 99,
      refillDisplay: 'RFP-240518-0002',
      customerId: 'cust-li',
      customerName: '李先生',
      jarSerial: null,
      storeId: MERCHANT_ID,
      paymentStatus: 'cancelled',
    });
    assert.equal(mapLedgerEntryToSettlementItemDraft(cancelledOnline, SCOPE), null);
    assert.equal(cancelledCashExtra.fundDirection, 'NO_SETTLEMENT');
    assert.equal(mapLedgerEntryToSettlementItemDraft(cancelledCashExtra, SCOPE), null);
    assert.equal(mapLedgerEntryToSettlementItemDraft(cancelledUnpaid, SCOPE), null);
  });

  it('does not create an item for unpaid refill', () => {
    const unpaid = classifyUnpaidRefill({
      id: 'refill-unpaid',
      createdAt: at('2024-05-18T10:00:00'),
      amount: 99,
      refillDisplay: 'RFP-240518-0001',
      customerId: 'cust-li',
      customerName: '李先生',
      jarSerial: null,
      storeId: MERCHANT_ID,
      paymentStatus: 'pending',
    });
    assert.equal(unpaid.sourceKind, 'unpaid_refill');
    assert.equal(mapLedgerEntryToSettlementItemDraft(unpaid, SCOPE), null);
    assert.equal(toCanonicalSettlementSourceKind('unpaid_refill'), null);
  });

  it('does not create a new item for settled or excluded ledger entries', () => {
    const settled = couponEntry({ settlementStatus: 'SETTLED' });
    const excludedCoupon = couponEntry({ id: 'cpn-ex', settlementStatus: 'EXCLUDED' });
    assert.equal(mapLedgerEntryToSettlementItemDraft(settled, SCOPE), null);
    assert.equal(mapLedgerEntryToSettlementItemDraft(excludedCoupon, SCOPE), null);
  });

  it('rounds amounts with existing POS TWD rules and keeps a safe integer', () => {
    const down = mapLedgerEntryToSettlementItemDraft(restockEntry({ amount: 10.4 }), SCOPE)!;
    const up = mapLedgerEntryToSettlementItemDraft(restockEntry({ id: 'restock-2', amount: 10.5 }), SCOPE)!;
    assert.equal(down.amountTwd, 10);
    assert.equal(up.amountTwd, 11);
    assert.equal(Number.isSafeInteger(down.amountTwd), true);
    assert.equal(Number.isSafeInteger(up.amountTwd), true);
  });

  it('does not create an item when the amount is zero after rounding', () => {
    assert.equal(mapLedgerEntryToSettlementItemDraft(restockEntry({ amount: 0 }), SCOPE), null);
    assert.equal(mapLedgerEntryToSettlementItemDraft(restockEntry({ amount: 0.4 }), SCOPE), null);
    assert.equal(
      mapLedgerEntryToSettlementItemDraft(couponEntry({ discountAmount: 0.4 }), SCOPE),
      null,
    );
  });

  it('converts UI sourceKind into canonical persistence sourceKind', () => {
    assert.equal(toCanonicalSettlementSourceKind('payment'), 'payment_order');
    assert.equal(toCanonicalSettlementSourceKind('restock'), 'restock_request');
    assert.equal(toCanonicalSettlementSourceKind('coupon'), 'grooming_coupon');
    assert.equal(toCanonicalSettlementSourceKind('reward'), 'reward_redemption');
    assert.deepEqual(LEDGER_UI_SOURCE_KIND_TO_PERSISTENCE, {
      payment: 'payment_order',
      restock: 'restock_request',
      coupon: 'grooming_coupon',
      reward: 'reward_redemption',
    });

    const payment = mapLedgerEntryToSettlementItemDraft(
      classifyPaymentOrder(
        refillPayment({
          id: 'pay-30-cash',
          purpose: 'extra_topup',
          amount: 30,
          provider: 'cash',
        }),
      )!,
      SCOPE,
    )!;
    const restock = mapLedgerEntryToSettlementItemDraft(restockEntry(), SCOPE)!;
    const coupon = mapLedgerEntryToSettlementItemDraft(couponEntry(), SCOPE)!;
    const reward = mapLedgerEntryToSettlementItemDraft(rewardEntry(), SCOPE)!;
    assert.equal(payment.sourceKind, 'payment_order');
    assert.equal(restock.sourceKind, 'restock_request');
    assert.equal(coupon.sourceKind, 'grooming_coupon');
    assert.equal(reward.sourceKind, 'reward_redemption');
    for (const item of [payment, restock, coupon, reward]) {
      assert.equal(['payment', 'coupon', 'reward', 'restock', 'unpaid_refill'].includes(item.sourceKind), false);
    }
  });

  it('rejects merchant scope mismatch instead of reattaching the fact', () => {
    const foreign = restockEntry({ storeId: 'merchant-other' });
    assert.throws(
      () => mapLedgerEntryToSettlementItemDraft(foreign, SCOPE, { merchantId: MERCHANT_ID }),
      MerchantScopeMismatchError,
    );
    assert.throws(
      () => mapLedgerEntriesToSettlementItemDrafts([foreign], SCOPE),
      MerchantScopeMismatchError,
    );
  });

  it('ignores protected client overrides', () => {
    const cash = classifyPaymentOrder(
      refillPayment({
        id: 'pay-30-cash',
        purpose: 'extra_topup',
        amount: 30,
        provider: 'cash',
      }),
    )!;
    const withoutOverrides = mapLedgerEntryToSettlementItemDraft(cash, SCOPE)!;
    const withOverrides = mapLedgerEntryToSettlementItemDraft(cash, SCOPE, CLIENT_OVERRIDES)!;
    assert.deepEqual(withOverrides, withoutOverrides);
    assert.equal(withOverrides.merchantId, MERCHANT_ID);
    assert.equal(withOverrides.amountTwd, 30);
    assert.equal(withOverrides.direction, 'STORE_TO_FURMOSA');
    assert.equal(withOverrides.collector, 'STORE');
    assert.equal(withOverrides.kind, 'EMPTY_JAR_SURCHARGE');
    assert.equal(withOverrides.sourceKind, 'payment_order');
    assert.equal(withOverrides.relatedOrderId, 'refill-12');
    assert.notEqual(withOverrides.description, 'forged');

    const online = classifyPaymentOrder(refillPayment())!;
    assert.equal(mapLedgerEntryToSettlementItemDraft(online, SCOPE, CLIENT_OVERRIDES), null);
  });

  it('does not mutate the original ledger entry', () => {
    const cash = classifyPaymentOrder(
      refillPayment({
        id: 'pay-30-cash',
        purpose: 'extra_topup',
        amount: 30,
        provider: 'cash',
      }),
    )!;
    const before = structuredClone(cash);
    const item = mapLedgerEntryToSettlementItemDraft(cash, SCOPE)!;
    item.amountTwd = 1;
    item.direction = 'FURMOSA_TO_STORE';
    item.merchantId = 'changed';
    item.occurredAt.setFullYear(1999);
    assert.deepEqual(cash, before);
    assert.equal(cash.amount, 30);
    assert.equal(cash.fundDirection, 'STORE_TO_FURMOSA');
    assert.equal(cash.storeId, MERCHANT_ID);
    assert.equal(cash.occurredAt.getFullYear(), before.occurredAt.getFullYear());
  });

  it('maps a mixed list by dropping NO_SETTLEMENT and returning only eligible items', () => {
    const online = classifyPaymentOrder(refillPayment())!;
    const cash = classifyPaymentOrder(
      refillPayment({
        id: 'pay-30-cash',
        purpose: 'extra_topup',
        amount: 30,
        provider: 'cash',
      }),
    )!;
    const coupon = couponEntry();
    const unpaid = classifyUnpaidRefill({
      id: 'refill-unpaid',
      createdAt: at('2024-05-18T10:00:00'),
      amount: 99,
      refillDisplay: 'RFP-240518-0001',
      customerId: 'cust-li',
      customerName: '李先生',
      jarSerial: null,
      storeId: MERCHANT_ID,
      paymentStatus: 'failed',
    });
    const restock = restockEntry();
    const items = mapLedgerEntriesToSettlementItemDrafts(
      [online, cash, coupon, unpaid, restock],
      SCOPE,
      CLIENT_OVERRIDES,
    );
    assert.deepEqual(
      items.map((item) => item.sourceKind),
      ['payment_order', 'grooming_coupon', 'restock_request'],
    );
    assert.deepEqual(
      items.map((item) => item.sourceId),
      ['pay-30-cash', 'cpn-1', 'restock-1'],
    );
    assert.equal(
      items.every(
        (item) => item.direction === 'STORE_TO_FURMOSA' || item.direction === 'FURMOSA_TO_STORE',
      ),
      true,
    );
  });

  it('does not infer direction from amount sign', () => {
    const subsidy = mapLedgerEntryToSettlementItemDraft(couponEntry({ discountAmount: 200 }), SCOPE)!;
    const payable = mapLedgerEntryToSettlementItemDraft(restockEntry({ amount: 200 }), SCOPE)!;
    assert.equal(subsidy.amountTwd, payable.amountTwd);
    assert.equal(subsidy.direction, 'FURMOSA_TO_STORE');
    assert.equal(payable.direction, 'STORE_TO_FURMOSA');
  });

  it('does not treat unproven adjustment ledger as merchant_stock_txn', () => {
    const adjustment = classifyAdjustment({
      id: 'adj-1',
      occurredAt: at('2024-05-19T12:00:00'),
      amount: 50,
      direction: 'STORE_TO_FURMOSA',
      reason: '盤差',
      createdBy: 'hq',
      storeId: MERCHANT_ID,
      relatedOrderId: null,
      relatedOrderDisplay: '盤差',
    });
    assert.equal(adjustment.sourceKind, 'adjustment');
    assert.equal(toCanonicalSettlementSourceKind('adjustment'), null);
    assert.equal(mapLedgerEntryToSettlementItemDraft(adjustment, SCOPE), null);
  });

  it('does not persist coupon reversal in v1 because identity would collide', () => {
    const reversal = classifyCouponReversal({
      id: 'cpn-1',
      customerId: 'cust-wang',
      customerName: '王小姐',
      couponId: 'coupon-row-1',
      couponCode: 'PT10-200',
      discountAmount: 200,
      relatedRefillOrderId: 'refill-12',
      relatedRefillDisplay: 'RFP-240428-0012',
      storeId: MERCHANT_ID,
      redeemedAt: at('2024-05-19T15:00:00'),
      reversedAt: at('2024-05-21T10:00:00'),
    });
    assert.equal(reversal.sourceId, 'cpn-1');
    assert.equal(mapLedgerEntryToSettlementItemDraft(reversal, SCOPE), null);
  });
});
