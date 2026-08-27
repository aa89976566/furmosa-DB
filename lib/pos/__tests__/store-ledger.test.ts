import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyCouponReversal,
  classifyCouponSubsidy,
  classifyPaymentOrder,
  classifyRestockCost,
  classifyUnpaidRefill,
  filterLedgerEntries,
  fundDirectionLabel,
  groupRefillReconciliations,
  isIncludedInSettlement,
  netSettlement,
  settlementStatusLabel,
  summarizeStoreLedger,
  toLedgerEntryView,
  txnTypeLabel,
  type LedgerEntry,
  type PaidPaymentSource,
} from '@/lib/pos/store-ledger';
import {
  DuplicateSettlementError,
  allowedPaymentMethods,
  buildSettlementSnapshot,
  persistStoreSettlement,
  runSettlementTransaction,
  selectSettlementItems,
} from '@/lib/pos/store-settlement';

const STORE = 'store-paopao';
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
    storeId: STORE,
    ...overrides,
  };
}

function samplePeriod() {
  return {
    storeId: STORE,
    periodStart: at('2024-05-01T00:00:00'),
    periodEnd: at('2024-05-20T23:59:59.999'),
  };
}

describe('store ledger classification', () => {
  it('does not put online refill NT$99 into store payables', () => {
    const entry = classifyPaymentOrder(refillPayment())!;
    assert.equal(txnTypeLabel(entry.transactionType), '換罐費');
    assert.equal(entry.amount, 99);
    assert.equal(entry.paymentCollector, 'FURMOSA');
    assert.equal(entry.fundDirection, 'NO_SETTLEMENT');
    assert.equal(isIncludedInSettlement(entry), false);
    assert.equal(fundDirectionLabel(entry), '匠寵已收');
    assert.equal(settlementStatusLabel(entry), '已入帳');
    const summary = summarizeStoreLedger([entry]);
    assert.equal(summary.storeOwesFurmosa, 0);
    assert.equal(summary.furmosaOwesStore, 0);
  });

  it('keeps online extra NT$30 out of store payables, but cash extra in', () => {
    const online = classifyPaymentOrder(
      refillPayment({
        id: 'pay-30-online',
        purpose: 'extra_topup',
        amount: 30,
        provider: 'ecpay',
      }),
    )!;
    assert.equal(txnTypeLabel(online.transactionType), '補差額');
    assert.equal(online.fundDirection, 'NO_SETTLEMENT');
    assert.equal(isIncludedInSettlement(online), false);
    assert.equal(summarizeStoreLedger([online]).storeOwesFurmosa, 0);

    const cash = classifyPaymentOrder(
      refillPayment({
        id: 'pay-30-cash',
        purpose: 'extra_topup',
        amount: 30,
        provider: 'cash',
      }),
    )!;
    assert.equal(cash.paymentCollector, 'STORE');
    assert.equal(cash.fundDirection, 'STORE_TO_FURMOSA');
    assert.equal(isIncludedInSettlement(cash), true);
    assert.equal(summarizeStoreLedger([cash]).storeOwesFurmosa, 30);
    assert.equal(summarizeStoreLedger([cash]).storeCollections, 30);
  });

  it('puts 10-point coupon NT$200 into furmosa payables with coupon trace', () => {
    const entry = classifyCouponSubsidy({
      id: 'cpn-1',
      customerId: 'cust-wang',
      customerName: '王小姐',
      couponId: 'coupon-row-1',
      couponCode: 'PT10-200',
      discountAmount: 200,
      relatedRefillOrderId: 'refill-12',
      relatedRefillDisplay: 'RFP-240428-0012',
      storeId: STORE,
      redeemedAt: at('2024-05-19T15:00:00'),
    });
    assert.equal(txnTypeLabel(entry.transactionType), '優惠券補貼');
    assert.equal(entry.paymentCollector, 'NONE');
    assert.equal(entry.fundDirection, 'FURMOSA_TO_STORE');
    assert.equal(entry.amount, 200);
    assert.equal(entry.customerId, 'cust-wang');
    assert.equal(entry.couponCode, 'PT10-200');
    assert.equal(entry.relatedOrderId, 'refill-12');
    assert.equal(summarizeStoreLedger([entry]).furmosaOwesStore, 200);
    assert.equal(summarizeStoreLedger([entry]).couponSubsidy, 200);
    const view = toLedgerEntryView(entry);
    assert.equal(view.customerName, '王小姐');
    assert.equal(view.couponCode, 'PT10-200');
    assert.equal(view.relatedOrderDisplay, 'RFP-240428-0012');
  });

  it('puts restock NT$3,450 into store payables', () => {
    const entry = classifyRestockCost({
      id: 'restock-1',
      occurredAt: at('2024-05-19T11:15:00'),
      amount: 3450,
      relatedOrderId: 'po-1',
      relatedOrderDisplay: 'PO-240519-003',
      storeId: STORE,
      content: '補貨單 PO-240519-003',
    });
    assert.equal(txnTypeLabel(entry.transactionType), '進貨款');
    assert.equal(entry.fundDirection, 'STORE_TO_FURMOSA');
    assert.equal(summarizeStoreLedger([entry]).storeOwesFurmosa, 3450);
    assert.equal(summarizeStoreLedger([entry]).restockCost, 3450);
  });

  it('excludes unpaid, failed, and cancelled payments from netting', () => {
    const unpaid = classifyUnpaidRefill({
      id: 'refill-unpaid',
      createdAt: at('2024-05-18T10:00:00'),
      amount: 99,
      refillDisplay: 'RFP-240518-0001',
      customerId: 'cust-li',
      customerName: '李先生',
      jarSerial: null,
      storeId: STORE,
      paymentStatus: 'pending',
    });
    const failed = classifyPaymentOrder(
      refillPayment({ id: 'pay-fail', status: 'failed', paidAt: null, amount: 99 }),
    )!;
    assert.equal(unpaid.settlementStatus, 'EXCLUDED');
    assert.equal(settlementStatusLabel(unpaid), '暫不列入結算');
    assert.equal(isIncludedInSettlement(unpaid), false);
    assert.equal(isIncludedInSettlement(failed), false);
    const summary = summarizeStoreLedger([unpaid, failed]);
    assert.equal(summary.storeOwesFurmosa, 0);
    assert.equal(summary.furmosaOwesStore, 0);
    assert.equal(summary.netAmount, 0);
  });

  it('nets either direction and does not hardcode store always paying', () => {
    const storeOwes = summarizeStoreLedger([
      classifyRestockCost({
        id: 'r1',
        occurredAt: at('2024-05-01T00:00:00'),
        amount: 3840,
        relatedOrderId: 'po',
        relatedOrderDisplay: 'PO-1',
        storeId: STORE,
        content: '進貨',
      }),
      classifyCouponSubsidy({
        id: 'c1',
        customerId: 'cust',
        customerName: '王小姐',
        couponId: 'c1',
        couponCode: 'A',
        discountAmount: 900,
        relatedRefillOrderId: null,
        relatedRefillDisplay: null,
        storeId: STORE,
        redeemedAt: at('2024-05-02T00:00:00'),
      }),
    ]);
    assert.equal(storeOwes.storeOwesFurmosa, 3840);
    assert.equal(storeOwes.furmosaOwesStore, 900);
    assert.equal(storeOwes.netAmount, 2940);
    assert.equal(storeOwes.payer, 'STORE');
    assert.equal(storeOwes.receiver, 'FURMOSA');
    assert.equal(storeOwes.resultLabel, '店家應匯給匠寵');

    const furmosaOwes = netSettlement(900, 2140);
    assert.equal(furmosaOwes.payer, 'FURMOSA');
    assert.equal(furmosaOwes.receiver, 'STORE');
    assert.equal(furmosaOwes.absoluteAmount, 1240);
    assert.equal(furmosaOwes.resultLabel, '匠寵應匯給店家');
    assert.deepEqual(allowedPaymentMethods('FURMOSA'), ['FURMOSA_TO_STORE_TRANSFER']);
    assert.ok(!allowedPaymentMethods('FURMOSA').includes('BANK_TRANSFER'));

    const even = netSettlement(0, 0);
    assert.equal(even.resultLabel, '本期無需付款');
  });

  it('keeps settled amount out of current netting', () => {
    const summary = summarizeStoreLedger(
      [
        classifyRestockCost({
          id: 'r1',
          occurredAt: at('2024-05-01T00:00:00'),
          amount: 100,
          relatedOrderId: 'po',
          relatedOrderDisplay: 'PO-1',
          storeId: STORE,
          content: '進貨',
        }),
      ],
      13330,
    );
    assert.equal(summary.settledAmount, 13330);
    assert.equal(summary.storeOwesFurmosa, 100);
    assert.equal(summary.netAmount, 100);
  });

  it('creates an independent reversal instead of deleting the original coupon entry', () => {
    const original = classifyCouponSubsidy({
      id: 'cpn-1',
      customerId: 'cust-wang',
      customerName: '王小姐',
      couponId: 'coupon-row-1',
      couponCode: 'PT10-200',
      discountAmount: 200,
      relatedRefillOrderId: 'refill-12',
      relatedRefillDisplay: 'RFP-240428-0012',
      storeId: STORE,
      redeemedAt: at('2024-05-19T15:00:00'),
    });
    const reversal = classifyCouponReversal({
      id: 'cpn-1',
      customerId: 'cust-wang',
      customerName: '王小姐',
      couponId: 'coupon-row-1',
      couponCode: 'PT10-200',
      discountAmount: 200,
      relatedRefillOrderId: 'refill-12',
      relatedRefillDisplay: 'RFP-240428-0012',
      storeId: STORE,
      redeemedAt: at('2024-05-19T15:00:00'),
      reversedAt: at('2024-05-21T10:00:00'),
    });
    assert.equal(txnTypeLabel(reversal.transactionType), '優惠券補貼沖銷');
    assert.equal(summarizeStoreLedger([original, reversal]).furmosaOwesStore, 0);
  });

  it('filters by order id, serial, and customer', () => {
    const entries = [
      classifyPaymentOrder(refillPayment())!,
      classifyRestockCost({
        id: 'r1',
        occurredAt: at('2024-05-19T11:15:00'),
        amount: 3450,
        relatedOrderId: 'po-1',
        relatedOrderDisplay: 'PO-240519-003',
        storeId: STORE,
        content: '補貨單 PO-240519-003',
      }),
    ];
    assert.equal(filterLedgerEntries(entries, { query: '38124491' }).length, 1);
    assert.equal(filterLedgerEntries(entries, { query: '王小姐' }).length, 1);
    assert.equal(filterLedgerEntries(entries, { query: 'PO-240519-003' }).length, 1);
    assert.equal(filterLedgerEntries(entries, { query: 'RFP-240428-0012' }).length, 1);
  });

  it('groups refill money on one reconciliation row', () => {
    const rows = groupRefillReconciliations([
      classifyPaymentOrder(refillPayment())!,
      classifyPaymentOrder(
        refillPayment({
          id: 'pay-30',
          purpose: 'extra_topup',
          amount: 30,
          provider: 'cash',
        }),
      )!,
      classifyCouponSubsidy({
        id: 'cpn-1',
        customerId: 'cust-wang',
        customerName: '王小姐',
        couponId: 'c1',
        couponCode: 'PT10-200',
        discountAmount: 200,
        relatedRefillOrderId: 'refill-12',
        relatedRefillDisplay: 'RFP-240428-0012',
        storeId: STORE,
        redeemedAt: at('2024-05-19T15:00:00'),
      }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.refillFee, 99);
    assert.equal(rows[0]?.surcharge, 30);
    assert.equal(rows[0]?.coupon, 200);
    assert.equal(rows[0]?.storeCollected, 30);
    assert.equal(rows[0]?.furmosaSubsidy, 200);
  });
});

describe('store settlement snapshot and atomic persist', () => {
  function periodEntries(): LedgerEntry[] {
    return [
      classifyPaymentOrder(refillPayment())!,
      classifyPaymentOrder(
        refillPayment({
          id: 'pay-30',
          purpose: 'extra_topup',
          amount: 30,
          provider: 'cash',
        }),
      )!,
      classifyCouponSubsidy({
        id: 'cpn-1',
        customerId: 'cust-wang',
        customerName: '王小姐',
        couponId: 'c1',
        couponCode: 'PT10-200',
        discountAmount: 200,
        relatedRefillOrderId: 'refill-12',
        relatedRefillDisplay: 'RFP-240428-0012',
        storeId: STORE,
        redeemedAt: at('2024-05-19T15:00:00'),
      }),
      classifyRestockCost({
        id: 'r1',
        occurredAt: at('2024-05-19T11:15:00'),
        amount: 3450,
        relatedOrderId: 'po-1',
        relatedOrderDisplay: 'PO-240519-003',
        storeId: STORE,
        content: '補貨單 PO-240519-003',
      }),
    ];
  }

  it('snapshots gross, payables, net, payer, receiver, and source ids', () => {
    const snapshot = buildSettlementSnapshot({
      ...samplePeriod(),
      entries: periodEntries(),
      paymentMethod: 'BANK_TRANSFER',
    });
    assert.equal(snapshot.storePayable, 3480);
    assert.equal(snapshot.furmosaPayable, 200);
    assert.equal(snapshot.netAmount, 3280);
    assert.equal(snapshot.payer, 'STORE');
    assert.equal(snapshot.receiver, 'FURMOSA');
    assert.ok(snapshot.itemSourceIds.includes('pay-30'));
    assert.ok(snapshot.itemSourceIds.includes('cpn-1'));
    assert.ok(snapshot.itemSourceIds.includes('r1'));
    assert.ok(!snapshot.itemSourceIds.includes('pay-99'));
    assert.equal(selectSettlementItems(periodEntries()).every((row) => row.relatedOrderId !== null || row.sourceKind === 'restock'), true);
  });

  it('rejects already settled sources before a new settlement', () => {
    const settledCoupon = classifyCouponSubsidy({
      id: 'cpn-1',
      customerId: 'cust-wang',
      customerName: '王小姐',
      couponId: 'c1',
      couponCode: 'PT10-200',
      discountAmount: 200,
      relatedRefillOrderId: 'refill-12',
      relatedRefillDisplay: 'RFP-240428-0012',
      storeId: STORE,
      redeemedAt: at('2024-05-19T15:00:00'),
      settlementStatus: 'SETTLED',
    });
    assert.throws(
      () =>
        buildSettlementSnapshot({
          ...samplePeriod(),
          entries: [settledCoupon],
          paymentMethod: 'BANK_TRANSFER',
        }),
      DuplicateSettlementError,
    );
  });

  it('creates settlement and items before marking sources, inside one transaction', async () => {
    const snapshot = buildSettlementSnapshot({
      ...samplePeriod(),
      entries: periodEntries(),
      paymentMethod: 'BANK_TRANSFER',
    });
    const calls: string[] = [];
    const result = await runSettlementTransaction(async (fn) => {
      calls.push('tx:start');
      const out = await fn({
        findSettledSourceIds: async () => {
          calls.push('find');
          return [];
        },
        createSettlement: async () => {
          calls.push('createSettlement');
          return { id: 'st-1' };
        },
        createItems: async () => {
          calls.push('createItems');
        },
        markSourcesSettled: async () => {
          calls.push('markSettled');
        },
      });
      calls.push('tx:end');
      return out;
    }, snapshot);
    assert.equal(result.id, 'st-1');
    assert.deepEqual(calls, [
      'tx:start',
      'find',
      'createSettlement',
      'createItems',
      'markSettled',
      'tx:end',
    ]);
  });

  it('does not mark sources settled when a source was already in another settlement', async () => {
    const snapshot = buildSettlementSnapshot({
      ...samplePeriod(),
      entries: periodEntries(),
      paymentMethod: 'BANK_TRANSFER',
    });
    const calls: string[] = [];
    await assert.rejects(
      () =>
        runSettlementTransaction(async (fn) => {
          return fn({
            findSettledSourceIds: async (ids) => {
              calls.push('find');
              return [ids[0]!];
            },
            createSettlement: async () => {
              calls.push('createSettlement');
              return { id: 'st-x' };
            },
            createItems: async () => {
              calls.push('createItems');
            },
            markSourcesSettled: async () => {
              calls.push('markSettled');
            },
          });
        }, snapshot),
      DuplicateSettlementError,
    );
    assert.deepEqual(calls, ['find']);
  });

  it('does not persist until StoreSettlement exists', async () => {
    const snapshot = buildSettlementSnapshot({
      ...samplePeriod(),
      entries: periodEntries(),
      paymentMethod: 'BANK_TRANSFER',
    });
    const result = await persistStoreSettlement(snapshot);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SCHEMA_MISSING');
  });

  it('returns the same totals when the same entries are summarized again', () => {
    const first = summarizeStoreLedger(periodEntries());
    const second = summarizeStoreLedger(periodEntries());
    assert.deepEqual(first, second);
  });
});
