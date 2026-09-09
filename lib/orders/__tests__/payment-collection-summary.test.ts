import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentCollectionSummary } from '@/lib/orders/payment-collection-summary';

test('已付款訂單全部列為實收', () => {
  assert.deepEqual(paymentCollectionSummary(120, 'paid'), {
    receivedAmount: 120,
    outstandingAmount: 0,
    note: null,
  });
});

test('未付款與貨到付款保留全部尾款', () => {
  assert.equal(paymentCollectionSummary(120, 'unpaid').outstandingAmount, 120);
  assert.equal(paymentCollectionSummary(120, 'cod').outstandingAmount, 120);
});

test('部分付款在沒有收款流水時不猜測金額', () => {
  const summary = paymentCollectionSummary(120, 'partial');
  assert.equal(summary.receivedAmount, null);
  assert.equal(summary.outstandingAmount, null);
  assert.match(summary.note ?? '', /收款流水帳/);
});

test('退款不列入淨實收，也不保留催收尾款', () => {
  assert.deepEqual(paymentCollectionSummary(120, 'refunded'), {
    receivedAmount: 0,
    outstandingAmount: 0,
    note: '款項已退款，不列入淨實收',
  });
});
