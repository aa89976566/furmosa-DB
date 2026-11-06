import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  analyzeRefillHistory,
  type RefillHistoryOrder,
  type RefillHistorySnapshot,
} from '@/lib/refill/history-audit';

const now = new Date('2026-11-06T12:00:00.000Z');
const old = new Date('2026-10-01T12:00:00.000Z');

function order(overrides: Partial<RefillHistoryOrder> = {}): RefillHistoryOrder {
  return {
    id: 'order-1',
    appointmentId: 'appointment-1',
    merchantId: 'merchant-1',
    orderType: 'exchange',
    deliveryMode: 'exchange',
    status: 'completed',
    baseAmount: 99,
    extraAmount: 0,
    totalAmount: 99,
    oldContainerSerial: '89601166',
    deliveredFlavourId: null,
    deliveredQuantity: null,
    paidAt: old,
    completedAt: old,
    createdAt: old,
    ...overrides,
  };
}

function snapshot(overrides: Partial<RefillHistorySnapshot> = {}): RefillHistorySnapshot {
  return {
    orders: [],
    payments: [],
    stockTxns: [],
    pointsLedger: [],
    settlementItems: [],
    ...overrides,
  };
}

describe('refill history audit', () => {
  it('reports all six anomaly categories with stable evidence', () => {
    const report = analyzeRefillHistory(
      snapshot({
        orders: [
          order({ id: 'duplicate-a', status: 'payment_pending' }),
          order({ id: 'duplicate-b', status: 'paid_waiting_return' }),
          order({ id: 'bad-price', appointmentId: 'appointment-2', oldContainerSerial: null, totalAmount: 129 }),
          order({ id: 'stale-paid', appointmentId: 'appointment-3', oldContainerSerial: null, status: 'paid_waiting_return' }),
          order({
            id: 'missing-stock',
            appointmentId: 'appointment-4',
            oldContainerSerial: null,
            deliveredFlavourId: 'flavour-1',
            deliveredQuantity: 1,
          }),
        ],
        payments: [
          {
            id: 'cash-topup',
            refillOrderId: 'stale-paid',
            purpose: 'extra_topup',
            provider: 'store_cash',
            status: 'paid',
            amount: 30,
            paidAt: old,
            createdAt: old,
          },
        ],
        pointsLedger: [
          { id: 'points-1', sourceType: 'refill_completed', sourceRefId: 'missing-stock', pointsChange: 1 },
          { id: 'points-2', sourceType: 'refill_completed', sourceRefId: 'missing-stock', pointsChange: 1 },
        ],
      }),
      { now },
    );

    assert.equal(report.totals.DUPLICATE_ELIGIBILITY, 2);
    assert.equal(report.totals.PRICE_MISMATCH, 1);
    assert.equal(report.totals.PAID_NOT_DELIVERED, 2);
    assert.equal(report.totals.DELIVERED_WITHOUT_STOCK_TXN, 1);
    assert.equal(report.totals.DUPLICATE_POINTS, 1);
    assert.equal(report.totals.MISSING_RECONCILIATION, 1);
    assert.deepEqual(
      report.anomalies.find((item) => item.type === 'DUPLICATE_POINTS')?.evidenceIds,
      ['points-1', 'points-2'],
    );
  });

  it('accepts correct first jar, exchange, and missing-jar top-up prices', () => {
    const report = analyzeRefillHistory(
      snapshot({
        orders: [
          order({ id: 'first', appointmentId: 'a1', oldContainerSerial: null, orderType: 'first', deliveryMode: 'first', baseAmount: 129, totalAmount: 129 }),
          order({ id: 'exchange', appointmentId: 'a2', oldContainerSerial: null }),
          order({ id: 'topup', appointmentId: 'a3', oldContainerSerial: null, deliveryMode: 'first', extraAmount: 30, totalAmount: 129 }),
        ],
      }),
      { now },
    );
    assert.equal(report.totals.PRICE_MISMATCH, 0);
  });

  it('does not require a stock transaction for legacy completion without delivered flavour', () => {
    const report = analyzeRefillHistory(snapshot({ orders: [order()] }), { now });
    assert.equal(report.totals.DELIVERED_WITHOUT_STOCK_TXN, 0);
  });

  it('recognizes modern delivery stock evidence', () => {
    const report = analyzeRefillHistory(
      snapshot({
        orders: [order({ deliveredFlavourId: 'flavour-1', deliveredQuantity: 1 })],
        stockTxns: [{ id: 'stock-1', reason: 'refill_delivery', note: '換罐交付 order-1' }],
      }),
      { now },
    );
    assert.equal(report.totals.DELIVERED_WITHOUT_STOCK_TXN, 0);
  });

  it('does not require settlement for online ECPay payments', () => {
    const report = analyzeRefillHistory(
      snapshot({
        payments: [
          {
            id: 'online',
            refillOrderId: 'order-1',
            purpose: 'extra_topup',
            provider: 'ecpay',
            status: 'paid',
            amount: 30,
            paidAt: old,
            createdAt: old,
          },
        ],
      }),
      { now },
    );
    assert.equal(report.totals.MISSING_RECONCILIATION, 0);
  });

  it('recognizes active settlement evidence for store-collected top-ups', () => {
    const report = analyzeRefillHistory(
      snapshot({
        payments: [
          {
            id: 'cash-topup',
            refillOrderId: 'order-1',
            purpose: 'extra_topup',
            provider: 'cash',
            status: 'paid',
            amount: 30,
            paidAt: old,
            createdAt: old,
          },
        ],
        settlementItems: [{ id: 'settlement-1', sourceKey: 'store_collection:cash-topup', voidedAt: null }],
      }),
      { now },
    );
    assert.equal(report.totals.MISSING_RECONCILIATION, 0);
  });
});
