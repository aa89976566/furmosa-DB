import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateOrderDiscount, buildVendorSettlementDraft } from '../vendor-settlement-draft';

test('折扣依商品金額比例分攤且每一元都對得上', () => {
  const allocated = allocateOrderDiscount([
    { id: 'a', subtotalTwd: 100 },
    { id: 'b', subtotalTwd: 200 },
    { id: 'c', subtotalTwd: 300 },
  ], 101);
  assert.deepEqual(Object.fromEntries(allocated), { a: 17, b: 34, c: 50 });
  assert.equal([...allocated.values()].reduce((sum, value) => sum + value, 0), 101);
});

test('同餘數時使用商品 id 穩定分配，不會每次結果不同', () => {
  const allocated = allocateOrderDiscount([
    { id: 'b', subtotalTwd: 100 },
    { id: 'a', subtotalTwd: 100 },
    { id: 'c', subtotalTwd: 100 },
  ], 1);
  assert.deepEqual(Object.fromEntries(allocated), { a: 1, b: 0, c: 0 });
});

test('QIQI 商品使用快照比例，折扣後按 25/75 建立草稿', () => {
  const result = buildVendorSettlementDraft('qiqi', [{
    id: 'order-1',
    orderNumber: 'SHOP-1044',
    orderedAt: new Date('2026-10-27T00:00:00Z'),
    paymentStatus: 'paid',
    status: 'confirmed',
    subtotalTwd: 600,
    discountTwd: 60,
    items: [
      {
        id: 'qiqi-line', productName: 'QIQI 凍乾', sku: 'QIQI-01', quantity: 1,
        weightGrams: 50, unit: '包', subtotalTwd: 200, isGift: false,
        supplierVendorIdSnapshot: 'qiqi', supplierFurmosaShareBpsSnapshot: 2_500,
      },
      {
        id: 'furmosa-line', productName: '匠寵商品', sku: 'FUR-01', quantity: 1,
        weightGrams: 50, unit: '包', subtotalTwd: 400, isGift: false,
        supplierVendorIdSnapshot: null, supplierFurmosaShareBpsSnapshot: null,
      },
    ],
  }]);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.lines.length, 1);
  assert.deepEqual(result.lines[0], {
    orderId: 'order-1',
    orderNumber: 'SHOP-1044',
    orderItemId: 'qiqi-line',
    vendorId: 'qiqi',
    grossCollectedTwd: 180,
    refundTwd: 0,
    furmosaShareBps: 2_500,
    furmosaShareTwd: 45,
    vendorPayableTwd: 135,
    occurredAt: new Date('2026-10-27T00:00:00Z'),
    sourceKey: 'order-item:qiqi-line:sale',
    sourceSnapshot: {
      rulesVersion: 'vendor-consignment-v1',
      orderNumber: 'SHOP-1044',
      orderItemId: 'qiqi-line',
      lineSubtotalTwd: 200,
      allocatedDiscountTwd: 20,
      productName: 'QIQI 凍乾',
      sku: 'QIQI-01',
      quantity: 1,
      weightGrams: 50,
      unit: '包',
    },
  });
});

test('退款、取消與金額對不起來時停止，不偷偷產生結算', () => {
  const base = {
    orderedAt: new Date('2026-10-27T00:00:00Z'),
    discountTwd: 0,
    items: [{
      id: 'line', productName: 'QIQI 凍乾', sku: 'QIQI-01', quantity: 1,
      weightGrams: 50, unit: '包', subtotalTwd: 100, isGift: false,
      supplierVendorIdSnapshot: 'qiqi', supplierFurmosaShareBpsSnapshot: 2_500,
    }],
  };
  const result = buildVendorSettlementDraft('qiqi', [
    { ...base, id: 'refund', orderNumber: 'REFUND', paymentStatus: 'refunded', status: 'confirmed', subtotalTwd: 100 },
    { ...base, id: 'cancel', orderNumber: 'CANCEL', paymentStatus: 'paid', status: 'cancelled', subtotalTwd: 100 },
    { ...base, id: 'mismatch', orderNumber: 'MISMATCH', paymentStatus: 'paid', status: 'confirmed', subtotalTwd: 99 },
  ]);
  assert.equal(result.lines.length, 0);
  assert.equal(result.blockers.length, 3);
});

test('拒絕小數台幣與超過商品小計的折扣', () => {
  assert.throws(() => allocateOrderDiscount([{ id: 'a', subtotalTwd: 100.5 }], 1));
  assert.throws(() => allocateOrderDiscount([{ id: 'a', subtotalTwd: 100 }], 101));
});
