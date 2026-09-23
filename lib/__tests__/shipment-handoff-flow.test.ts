import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dispatchAction } from '@/lib/shipment-dispatch';
import { shipmentStatusErrorMessage } from '@/lib/shipment-status-error';
import { mapShopifyFulfillmentStatus } from '@/lib/shopify/shipment-events';
import { assembleShipmentQueueRow } from '@/lib/shipment-queue-rows';

const handoff = readFileSync('components/shipments/handoff-control.tsx', 'utf8');
const actions = readFileSync('app/(main)/shipments/actions.ts', 'utf8');

test('建立寄件單不會變成 shipped，也不會寫入交寄時間', () => {
  assert.deepEqual(
    dispatchAction({ status: 'pending', shippingMethod: 'convenience', cvsBrand: '711' }),
    { type: 'create-label', label: '建立 7-11 寄件單' },
  );
  assert.deepEqual(
    dispatchAction({ status: 'packed', carrier: '黑貓', shippingMethod: 'home' }),
    { type: 'create-label', label: '建立黑貓託運單' },
  );
  assert.match(handoff, /form\.set\('next', status === 'packed' \? 'packed' : 'packed'\)/);
  assert.match(handoff, /form\.set\('labelIntent', '1'\)/);
  assert.doesNotMatch(handoff, /<form/);
  assert.match(actions, /if \(next === 'packed'\) data\.packedAt = now;/);
  assert.match(actions, /if \(next === 'shipped'\) \{\s*data\.packedAt = shipment\.packedAt \?\? now;\s*data\.shippedAt = now;/);
  assert.equal(
    mapShopifyFulfillmentStatus({ id: 1, order_id: 1, status: 'success', shipment_status: null }),
    'packed',
  );
});

test('只有人工確認已交寄後才會變成 shipped', () => {
  assert.equal(
    dispatchAction({
      status: 'packed',
      carrier: '黑貓',
      trackingNumber: 'TW12345678',
    }).type,
    'confirm-handoff',
  );
  assert.match(handoff, /form\.set\('next', 'shipped'\)/);
  assert.match(handoff, /form\.set\('handoffConfirmed', '1'\)/);
  assert.match(handoff, /type="button"/);
  assert.match(actions, /請先確認已交寄，系統不會自動標記為已寄出/);
  assert.match(actions, /formData\.get\('handoffConfirmed'\) !== '1'/);
});

test('撤回缺少反向帳規則時必須明確失敗', () => {
  assert.match(
    shipmentStatusErrorMessage(new Error('已出貨不能退回未完成狀態')),
    /撤回沒有成功/,
  );
  assert.match(actions, /correctionConfirmed/);
  assert.match(actions, /請填寫撤回原因/);
});

test('單筆訂單缺漏不會讓出貨清單整頁失敗', () => {
  const row = assembleShipmentQueueRow(
    {
      id: 'shp-preview-gap',
      shipmentNumber: 'SHP-PREVIEW-GAP',
      type: 'customer_order',
      status: 'pending',
      createdAt: new Date('2026-09-22T00:00:00.000Z'),
      orderId: 'missing-order',
      order: null,
      items: [{ productId: 'missing-product', productName: '測試商品', quantity: 1, weightGrams: 30, productFound: false }],
    },
    { fulfillmentFeeLabel: null, paymentReviewHold: false },
    [],
  );
  assert.equal(row.shipmentNumber, 'SHP-PREVIEW-GAP');
  assert.equal(row.status, 'pending');
  assert.equal(row.order, null);
  assert.ok(row.gaps?.includes('訂單未對應'));
  assert.ok(row.gaps?.includes('商品未對應'));
});
