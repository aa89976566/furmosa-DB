import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewSnapshotView } from '../inbox';
import { snapshotHash, type Snapshot } from '@/lib/shopify/intake-policy';

const original: Snapshot = { schemaVersion: 1, order: {
  total_price: '100.00', subtotal_price: '100.00', currency: 'TWD',
  line_items: [{ title: '測試商品', quantity: 1, price: '100.00' }],
} };
const audit = { id: 'adjustment-latest', metadataJson: JSON.stringify({
  version: 1, sourceHash: snapshotHash(original), reason: '人工調整',
  after: { lines: [{ title: '測試商品', quantity: 3, price: '80.00' }], subtotal: '240.00', shippingFee: '10.00', total: '250.00' },
}) };

test('審核清單呈現 HQ 最新數量與金額，來源快照不變', () => {
  const view = reviewSnapshotView(original, audit);
  assert.equal(view.source?.total, '250.00');
  assert.equal(view.source?.items[0].quantity, 3);
  assert.equal(view.adjusted, true);
  assert.equal(view.conflict, false);
  assert.equal(original.order.total_price, '100.00');
});

test('來源更新時不沿用舊調整金額，清單提示重新核對', () => {
  const latest = { ...original, order: { ...original.order, total_price: '180.00' } };
  const view = reviewSnapshotView(latest, audit);
  assert.equal(view.source?.total, '180.00');
  assert.equal(view.adjusted, false);
  assert.equal(view.conflict, true);
});

test('沒有人工調整的舊訂單保留原有顯示', () => {
  const view = reviewSnapshotView(original, null);
  assert.equal(view.source?.total, '100.00');
  assert.equal(view.source?.items[0].quantity, 1);
  assert.equal(view.conflict, false);
});
