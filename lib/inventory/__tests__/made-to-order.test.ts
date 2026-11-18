import assert from 'node:assert/strict';
import test from 'node:test';
import { madeToOrderDemand, type ProductionOrder } from '../made-to-order';
import { buildReorderAlertSummary } from '../reorder-alerts';
import { isMadeToOrderHqProduct } from '../shipment-advisory';

const line = { productId: 'p', productName: '雞肉南瓜', quantity: 3, weightGrams: 50, variantKey: 't',
  product: { sku: 'FUR-0014', unit: 'g', priceTiers: [{ id: 't', weightGrams: 50, unit: 'g', unitQty: 1 }] } };
const order: ProductionOrder = { id: 'o', orderNumber: 'ORD-1', status: 'confirmed', paymentStatus: 'paid',
  fulfillmentStatus: 'pending', omsStatus: null, deletedAt: null, items: [line], shipments: [] };

test('all user-confirmed made-to-order SKUs bypass finished-stock procurement, salmon stays stocked', () => {
  for (const sku of ['FUR-0002', 'fur-0014', 'FUR-0001', 'BF-03-30G']) {
    assert.equal(isMadeToOrderHqProduct(sku), true);
    const alerts = buildReorderAlertSummary([{ id: 'p', name: '現做', sku, reorderPoint: 50,
      vendorName: null, onHand: -150, unit: 'g', lastCountedAt: null, incoming: 0 }]);
    assert.deepEqual(alerts, { orderNow: [], incoming: [], stocktake: [] });
  }
  assert.equal(isMadeToOrderHqProduct('FUR-0129'), false);
});

test('partial shipment subtracts once; packed and cancelled shipments do not consume demand', () => {
  const shipment = { status: 'shipped', items: [{ ...line, quantity: 1 }] };
  const result = madeToOrderDemand([{ ...order, shipments: [shipment,
    { ...shipment, status: 'packed' }, { ...shipment, status: 'cancelled' }] }]);
  assert.equal(result.rows[0].grams, 100);
  assert.equal(result.complete, true);
  assert.equal(madeToOrderDemand([{ ...order, shipments: [{ ...shipment, items: [line] }] }]).rows.length, 0);
});

test('cancelled, refunded, deleted, draft legacy and fulfilled orders do not become production', () => {
  for (const change of [{ status: 'cancelled' }, { paymentStatus: 'refunded' }, { deletedAt: new Date() },
    { status: 'draft' }, { fulfillmentStatus: 'shipped' }]) {
    assert.equal(madeToOrderDemand([{ ...order, ...change }]).rows.length, 0);
  }
  assert.equal(madeToOrderDemand([{ ...order, status: 'draft', omsStatus: 'REVIEW' }]).rows[0].reviewRequired, true);
  assert.equal(madeToOrderDemand([{ ...order, omsStatus: 'READY' }]).rows[0].reviewRequired, false);
});

test('invalid units, ambiguous tier and over-shipment remain visible without invented grams', () => {
  const invalid = { ...line, variantKey: 'unknown' };
  assert.equal(madeToOrderDemand([{ ...order, items: [invalid] }]).rows[0].grams, null);
  assert.equal(madeToOrderDemand([{ ...order, items: [invalid] }]).complete, false);
  assert.equal(madeToOrderDemand([{ ...order, shipments: [{ status: 'shipped', items: [{ ...line, quantity: 4 }] }] }]).rows[0].grams, null);
  assert.equal(madeToOrderDemand([order], true).complete, false);
  assert.equal(madeToOrderDemand([{ ...order, items: [{ ...line, product: { ...line.product, sku: 'FUR-0129' } }] }]).rows.length, 0);
});
