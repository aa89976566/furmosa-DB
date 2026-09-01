import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { parseShopifyAuditMetadata, SHOPIFY_AUDIT_METADATA_KEYS } from '@/lib/shopify/event-version';
import { selectLinkedCustomerShipment } from '@/lib/shopify/shipment-events';
import { processShopifyWebhook } from '@/lib/shopify/webhook-process';
import type { MatchableProduct } from '@/lib/shopify/match-line-item';
import type { ShopifyOrderRecord } from '@/lib/shopify/webhook-store';
import { FakeShopifyStore, sampleShipment } from './fake-webhook-store';

const SECRET = 'webhook-test-secret';
const SHOP = 'furmosa-test.myshopify.com';
const PII = ['customer@example.com', '0912345678', '台北市信義區假資料路1號'];

const product30g: MatchableProduct = {
  id: 'prod-30',
  name: '鴨喉嚨',
  sku: 'FUR-0030',
  sourceSku: 'CK-30',
  unit: '包',
  priceTiers: [{ weightGrams: 30, price: 84 }],
};

function sign(body: string) {
  return createHmac('sha256', SECRET).update(body, 'utf8').digest('base64');
}

function requestFor(topic: string, payload: Record<string, unknown>, webhookId: string) {
  const raw = JSON.stringify(payload);
  return new Request(`http://localhost/api/shopify/webhooks/${topic}`, {
    method: 'POST',
    headers: {
      'x-shopify-hmac-sha256': sign(raw),
      'x-shopify-topic': topic,
      'x-shopify-shop-domain': SHOP,
      'x-shopify-webhook-id': webhookId,
    },
    body: raw,
  });
}

function baseOrder(shipments: ShopifyOrderRecord['shipments'] = []): ShopifyOrderRecord {
  return {
    id: 'ord_seed',
    orderNumber: 'SHOP-2001-002001',
    source: 'shopify',
    externalStore: SHOP,
    externalOrderId: '2001',
    externalOrderName: '#2001',
    status: 'pending_review',
    paymentStatus: 'paid',
    fulfillmentStatus: 'pending',
    shippingFeeType: 'unpaid',
    customerId: null,
    subtotal: 84,
    discount: 0,
    shippingFee: 0,
    companyShippingCost: 0,
    total: 84,
    shippingMethod: 'home',
    shippingAddress: '台北市信義區假資料路1號',
    cvsBrand: null,
    cvsStoreId: null,
    cvsStoreName: null,
    note: 'seed',
    orderedAt: new Date('2026-09-01T00:00:00Z'),
    items: [
      {
        id: 'item_1',
        sku: 'CK-30',
        quantity: 1,
        productId: 'prod-30',
        productName: '鴨喉嚨 30g',
        unitPrice: 84,
        subtotal: 84,
        weightGrams: 30,
        unit: 'g',
      },
    ],
    shipments,
  };
}

function assertSafeAudits(store: FakeShopifyStore) {
  for (const row of store.audits) {
    const meta = parseShopifyAuditMetadata(row.metadataJson);
    assert.ok(meta);
    assert.deepEqual(Object.keys(meta).sort(), [...SHOPIFY_AUDIT_METADATA_KEYS].sort());
    const raw = row.metadataJson ?? '';
    for (const secret of PII) assert.equal(raw.includes(secret), false);
  }
}

describe('Shopify cancellation, fulfillment and refund webhooks', () => {
  it('never selects a cancelled customer_order shipment when a live row exists', () => {
    const cancelled = sampleShipment('cancelled', 'shp_old');
    const pending = sampleShipment('pending', 'shp_new');
    const packed = sampleShipment('packed', 'shp_packed');
    assert.equal(selectLinkedCustomerShipment(baseOrder([cancelled, pending]))?.id, 'shp_new');
    assert.equal(selectLinkedCustomerShipment(baseOrder([pending, cancelled, packed]))?.id, 'shp_packed');
    assert.equal(selectLinkedCustomerShipment(baseOrder([cancelled]))?.id, 'shp_old');
    assert.equal(selectLinkedCustomerShipment(baseOrder([])), null);
  });

  it('targets only the live shipment when a cancelled row and a new active row both exist', async () => {
    const cancelStore = new FakeShopifyStore();
    cancelStore.seedOrder(baseOrder([sampleShipment('cancelled', 'shp_old'), sampleShipment('pending', 'shp_new')]));
    const cancelled = await processShopifyWebhook(
      requestFor('orders/cancelled', { id: 2001, updated_at: '2026-09-01T06:00:00Z' }, 'wh-cancel-active'),
      'orders/cancelled',
      { db: cancelStore, secret: SECRET },
    );
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.sync?.updated, true);
    const cancelledOrder = cancelStore.getOrder(SHOP, '2001');
    assert.equal(cancelledOrder?.shipments.find((row) => row.id === 'shp_old')?.status, 'cancelled');
    assert.equal(cancelledOrder?.shipments.find((row) => row.id === 'shp_new')?.status, 'cancelled');
    assert.ok(cancelledOrder?.shipments.find((row) => row.id === 'shp_old')?.cancelledAt);
    assert.equal(cancelStore.shipmentCreates, 0);

    const resurrect = await processShopifyWebhook(
      requestFor(
        'fulfillments/create',
        {
          id: 9,
          order_id: 2001,
          status: 'success',
          shipment_status: 'in_transit',
          updated_at: '2026-09-01T06:30:00Z',
        },
        'wh-no-resurrect',
      ),
      'fulfillments/create',
      { db: cancelStore, secret: SECRET },
    );
    assert.equal(resurrect.status, 200);
    assert.equal(resurrect.body.decision, 'ignored_terminal');
    const stillCancelled = cancelStore.getOrder(SHOP, '2001');
    assert.equal(stillCancelled?.shipments.find((row) => row.id === 'shp_old')?.status, 'cancelled');
    assert.equal(stillCancelled?.shipments.find((row) => row.id === 'shp_new')?.status, 'cancelled');

    const fulfillStore = new FakeShopifyStore();
    fulfillStore.seedOrder(baseOrder([sampleShipment('cancelled', 'shp_old'), sampleShipment('pending', 'shp_new')]));
    const packed = await processShopifyWebhook(
      requestFor(
        'fulfillments/update',
        {
          id: 9,
          order_id: 2001,
          status: 'success',
          shipment_status: 'label_printed',
          updated_at: '2026-09-01T07:00:00Z',
        },
        'wh-pack-active',
      ),
      'fulfillments/update',
      { db: fulfillStore, secret: SECRET },
    );
    assert.equal(packed.status, 200);
    assert.equal(packed.sync?.updated, true);
    const packedOrder = fulfillStore.getOrder(SHOP, '2001');
    assert.equal(packedOrder?.shipments.find((row) => row.id === 'shp_old')?.status, 'cancelled');
    assert.equal(packedOrder?.shipments.find((row) => row.id === 'shp_new')?.status, 'packed');

    const shipped = await processShopifyWebhook(
      requestFor(
        'fulfillments/create',
        {
          id: 9,
          order_id: 2001,
          status: 'success',
          shipment_status: 'in_transit',
          updated_at: '2026-09-01T08:00:00Z',
        },
        'wh-ship-active',
      ),
      'fulfillments/create',
      { db: fulfillStore, secret: SECRET },
    );
    assert.equal(shipped.status, 200);
    const shippedOrder = fulfillStore.getOrder(SHOP, '2001');
    assert.equal(shippedOrder?.shipments.find((row) => row.id === 'shp_old')?.status, 'cancelled');
    assert.equal(shippedOrder?.shipments.find((row) => row.id === 'shp_new')?.status, 'shipped');

    const regress = await processShopifyWebhook(
      requestFor(
        'fulfillments/update',
        {
          id: 9,
          order_id: 2001,
          status: 'success',
          shipment_status: 'label_printed',
          updated_at: '2026-09-01T09:00:00Z',
        },
        'wh-regress-active',
      ),
      'fulfillments/update',
      { db: fulfillStore, secret: SECRET },
    );
    assert.equal(regress.status, 200);
    assert.equal(regress.sync?.ignored, true);
    assert.equal(regress.body.decision, 'ignored_stale');
    const finalOrder = fulfillStore.getOrder(SHOP, '2001');
    assert.equal(finalOrder?.shipments.find((row) => row.id === 'shp_old')?.status, 'cancelled');
    assert.equal(finalOrder?.shipments.find((row) => row.id === 'shp_new')?.status, 'shipped');
    assertSafeAudits(fulfillStore);
  });

  it('cancels pending and packed shipments and ignores shipped or delivered', async () => {
    for (const allowed of ['pending', 'packed'] as const) {
      const store = new FakeShopifyStore();
      store.seedProduct(product30g);
      store.seedOrder(baseOrder([sampleShipment(allowed)]));
      const result = await processShopifyWebhook(
        requestFor('orders/cancelled', { id: 2001, updated_at: '2026-09-01T06:00:00Z' }, `wh-cancel-${allowed}`),
        'orders/cancelled',
        { db: store, secret: SECRET },
      );
      assert.equal(result.status, 200);
      assert.equal(store.getOrder(SHOP, '2001')?.shipments[0]?.status, 'cancelled');
      assert.equal(store.shipmentCreates, 0);
    }

    for (const blocked of ['shipped', 'delivered'] as const) {
      const store = new FakeShopifyStore();
      store.seedProduct(product30g);
      store.seedOrder(baseOrder([sampleShipment(blocked)]));
      const result = await processShopifyWebhook(
        requestFor('orders/cancelled', { id: 2001, updated_at: '2026-09-01T06:00:00Z' }, `wh-cancel-${blocked}`),
        'orders/cancelled',
        { db: store, secret: SECRET },
      );
      assert.equal(result.status, 200);
      assert.equal(result.sync?.ignored, true);
      assert.equal(store.getOrder(SHOP, '2001')?.shipments[0]?.status, blocked);
    }

    const missing = new FakeShopifyStore();
    const noShipment = await processShopifyWebhook(
      requestFor('orders/cancelled', { id: 2001, updated_at: '2026-09-01T06:00:00Z' }, 'wh-cancel-missing'),
      'orders/cancelled',
      { db: missing, secret: SECRET },
    );
    assert.equal(noShipment.status, 200);
    assert.equal(noShipment.body.decision, 'ignored_missing_order');
    assert.equal(missing.orders.size, 0);
    assert.equal(missing.shipmentCreates, 0);
  });

  it('progresses fulfillment monotonically and stays audit-only for unknown, missing or cancelled', async () => {
    const store = new FakeShopifyStore();
    store.seedOrder(baseOrder([sampleShipment('pending')]));
    const packed = await processShopifyWebhook(
      requestFor(
        'fulfillments/update',
        {
          id: 9,
          order_id: 2001,
          status: 'success',
          shipment_status: 'label_printed',
          updated_at: '2026-09-01T07:00:00Z',
        },
        'wh-pack',
      ),
      'fulfillments/update',
      { db: store, secret: SECRET },
    );
    assert.equal(packed.status, 200);
    assert.equal(store.getOrder(SHOP, '2001')?.shipments[0]?.status, 'packed');

    const shipped = await processShopifyWebhook(
      requestFor(
        'fulfillments/create',
        {
          id: 9,
          order_id: 2001,
          status: 'success',
          shipment_status: 'in_transit',
          updated_at: '2026-09-01T08:00:00Z',
        },
        'wh-ship',
      ),
      'fulfillments/create',
      { db: store, secret: SECRET },
    );
    assert.equal(shipped.status, 200);
    assert.equal(store.getOrder(SHOP, '2001')?.shipments[0]?.status, 'shipped');

    const delivered = await processShopifyWebhook(
      requestFor(
        'fulfillments/update',
        {
          id: 9,
          order_id: 2001,
          status: 'success',
          shipment_status: 'delivered',
          updated_at: '2026-09-01T09:00:00Z',
        },
        'wh-deliv',
      ),
      'fulfillments/update',
      { db: store, secret: SECRET },
    );
    assert.equal(delivered.status, 200);
    assert.equal(store.getOrder(SHOP, '2001')?.shipments[0]?.status, 'delivered');

    const regress = await processShopifyWebhook(
      requestFor(
        'fulfillments/update',
        {
          id: 9,
          order_id: 2001,
          status: 'success',
          shipment_status: 'label_printed',
          updated_at: '2026-09-01T10:00:00Z',
        },
        'wh-regress',
      ),
      'fulfillments/update',
      { db: store, secret: SECRET },
    );
    assert.equal(regress.status, 200);
    assert.equal(regress.sync?.ignored, true);
    assert.equal(store.getOrder(SHOP, '2001')?.shipments[0]?.status, 'delivered');

    const stale = await processShopifyWebhook(
      requestFor(
        'fulfillments/update',
        {
          id: 9,
          order_id: 2001,
          status: 'success',
          shipment_status: 'delivered',
          updated_at: '2026-09-01T01:00:00Z',
        },
        'wh-ff-stale',
      ),
      'fulfillments/update',
      { db: store, secret: SECRET },
    );
    assert.equal(stale.status, 200);
    assert.equal(stale.body.decision, 'ignored_stale');

    const duplicate = await processShopifyWebhook(
      requestFor(
        'fulfillments/update',
        {
          id: 9,
          order_id: 2001,
          status: 'success',
          shipment_status: 'delivered',
          updated_at: '2026-09-01T09:00:00Z',
        },
        'wh-deliv',
      ),
      'fulfillments/update',
      { db: store, secret: SECRET },
    );
    assert.equal(duplicate.sync?.decision, 'ignored_duplicate');

    const cancelledStore = new FakeShopifyStore();
    cancelledStore.seedOrder(baseOrder([sampleShipment('cancelled')]));
    const terminal = await processShopifyWebhook(
      requestFor(
        'fulfillments/create',
        { id: 9, order_id: 2001, status: 'success', updated_at: '2026-09-01T11:00:00Z' },
        'wh-term',
      ),
      'fulfillments/create',
      { db: cancelledStore, secret: SECRET },
    );
    assert.equal(terminal.body.decision, 'ignored_terminal');
    assert.equal(cancelledStore.getOrder(SHOP, '2001')?.shipments[0]?.status, 'cancelled');

    const unknown = await processShopifyWebhook(
      requestFor(
        'fulfillments/update',
        { id: 9, order_id: 2001, status: 'error', updated_at: '2026-09-01T12:00:00Z' },
        'wh-unknown',
      ),
      'fulfillments/update',
      { db: store, secret: SECRET },
    );
    assert.equal(unknown.body.decision, 'ignored_unknown_status');

    const missing = new FakeShopifyStore();
    missing.seedOrder(baseOrder([]));
    const noShipment = await processShopifyWebhook(
      requestFor(
        'fulfillments/create',
        { id: 9, order_id: 2001, status: 'success', updated_at: '2026-09-01T13:00:00Z' },
        'wh-miss-ship',
      ),
      'fulfillments/create',
      { db: missing, secret: SECRET },
    );
    assert.equal(noShipment.body.decision, 'ignored_missing_shipment');
    assert.equal(missing.shipmentCreates, 0);
    assertSafeAudits(store);
  });

  it('audits refunds without mutating payment, inventory or settlements', async () => {
    const store = new FakeShopifyStore();
    store.seedOrder(baseOrder([sampleShipment('pending')]));
    const result = await processShopifyWebhook(
      requestFor(
        'refunds/create',
        {
          id: 55,
          order_id: 2001,
          created_at: '2026-09-01T14:00:00Z',
          email: 'customer@example.com',
        },
        'wh-refund',
      ),
      'refunds/create',
      { db: store, secret: SECRET },
    );
    assert.equal(result.status, 200);
    assert.equal(result.sync?.ignored, true);
    const order = store.getOrder(SHOP, '2001');
    assert.equal(order?.paymentStatus, 'paid');
    assert.equal(order?.shipments[0]?.status, 'pending');
    assert.equal(store.inventoryWrites, 0);
    assert.equal(store.settlementWrites, 0);
    assert.equal(store.customerWrites, 0);
    assertSafeAudits(store);
  });

  it('does not add a Shipment creation path in webhook modules or routes', () => {
    const files = [
      'lib/shopify/order-sync.ts',
      'lib/shopify/shipment-events.ts',
      'lib/shopify/webhook-process.ts',
      'lib/shopify/webhook-http.ts',
      'app/api/shopify/webhooks/orders-cancelled/route.ts',
      'app/api/shopify/webhooks/refunds-create/route.ts',
      'app/api/shopify/webhooks/fulfillments-create/route.ts',
      'app/api/shopify/webhooks/fulfillments-update/route.ts',
    ];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      assert.doesNotMatch(src, /shipment\.create/);
      assert.doesNotMatch(src, /shipments:\s*\{\s*create/);
    }
  });
});
