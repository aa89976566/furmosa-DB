import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { parseShopifyAuditMetadata, SHOPIFY_AUDIT_METADATA_KEYS } from '@/lib/shopify/event-version';
import { processShopifyWebhook } from '@/lib/shopify/webhook-process';
import { SHOPIFY_CONFLICT_RETRY_ATTEMPTS } from '@/lib/shopify/webhook-store';
import { FakeShopifyStore, sampleShipment } from './fake-webhook-store';
import type { MatchableProduct } from '@/lib/shopify/match-line-item';
import type { ShopifyOrderRecord } from '@/lib/shopify/webhook-store';

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

function orderPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 2001,
    name: '#2001',
    financial_status: 'pending',
    updated_at: '2026-09-01T00:00:00Z',
    subtotal_price: '84',
    total_discounts: '0',
    total_price: '84',
    email: 'customer@example.com',
    phone: '0912345678',
    shipping_address: {
      name: '測試客戶',
      address1: '台北市信義區假資料路1號',
      phone: '0912345678',
    },
    line_items: [{ sku: 'CK-30', title: '鴨喉嚨 30g', quantity: 1, price: '84', grams: 30 }],
    ...overrides,
  };
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

function storeWithProduct() {
  const store = new FakeShopifyStore();
  store.seedProduct(product30g);
  return store;
}

async function post(
  store: FakeShopifyStore,
  topic: 'orders/create' | 'orders/paid' | 'orders/updated',
  payload: Record<string, unknown>,
  webhookId: string,
  sleep?: (ms: number) => Promise<void>,
) {
  return processShopifyWebhook(requestFor(topic, payload, webhookId), topic, {
    db: store,
    secret: SECRET,
    sleep,
  });
}

function assertSafeAudits(store: FakeShopifyStore) {
  for (const row of store.audits) {
    const meta = parseShopifyAuditMetadata(row.metadataJson);
    assert.ok(meta);
    assert.deepEqual(Object.keys(meta).sort(), [...SHOPIFY_AUDIT_METADATA_KEYS].sort());
    const raw = row.metadataJson ?? '';
    for (const secret of PII) {
      assert.equal(raw.includes(secret), false);
    }
    assert.equal(raw.includes('"line_items"'), false);
    assert.equal(raw.includes('shipping_address'), false);
  }
}

describe('Shopify order webhook event ordering and persistence', () => {
  it('applies create then paid independently', async () => {
    const store = storeWithProduct();
    const created = await post(store, 'orders/create', orderPayload(), 'wh-create');
    assert.equal(created.status, 200);
    assert.equal(created.sync?.created, true);
    assert.equal(store.getOrder(SHOP, '2001')?.orderNumber, 'SHOPIFY-01');
    assert.equal(store.getOrder(SHOP, '2001')?.paymentStatus, 'unpaid');
    const paid = await post(
      store,
      'orders/paid',
      orderPayload({ financial_status: 'paid', updated_at: '2026-09-01T01:00:00Z' }),
      'wh-paid',
    );
    assert.equal(paid.status, 200);
    assert.equal(store.getOrder(SHOP, '2001')?.paymentStatus, 'paid');
    assert.equal(store.getOrder(SHOP, '2001')?.items[0]?.weightGrams, 30);
    assertSafeAudits(store);
  });

  it('keeps payment when paid arrives before create', async () => {
    const store = storeWithProduct();
    const paid = await post(
      store,
      'orders/paid',
      orderPayload({ financial_status: 'paid', updated_at: '2026-09-01T01:00:00Z' }),
      'wh-paid-first',
    );
    assert.equal(paid.status, 200);
    assert.equal(store.getOrder(SHOP, '2001')?.paymentStatus, 'paid');
    const created = await post(
      store,
      'orders/create',
      orderPayload({ updated_at: '2026-09-01T00:00:00Z' }),
      'wh-create-later',
    );
    assert.equal(created.status, 200);
    assert.equal(created.sync?.ignored, true);
    assert.equal(store.getOrder(SHOP, '2001')?.paymentStatus, 'paid');
  });

  it('lets a newer snapshot apply after paid without regressing payment', async () => {
    const store = storeWithProduct();
    await post(
      store,
      'orders/paid',
      orderPayload({ financial_status: 'paid', updated_at: '2026-09-01T01:00:00Z' }),
      'wh-paid',
    );
    const updated = await post(
      store,
      'orders/updated',
      orderPayload({
        financial_status: 'paid',
        updated_at: '2026-09-01T02:00:00Z',
        note_attributes: [
          { name: '超商品牌', value: '7-ELEVEN' },
          { name: '取貨縣市', value: '台北市' },
          { name: '取貨區域', value: '信義區' },
          { name: '取貨門市名稱', value: '市府' },
          { name: '取貨門市店號', value: '123456' },
        ],
      }),
      'wh-updated',
    );
    assert.equal(updated.status, 200);
    const order = store.getOrder(SHOP, '2001');
    assert.equal(order?.paymentStatus, 'paid');
    assert.equal(order?.shippingMethod, 'convenience');
    assert.equal(order?.cvsBrand, '711');
    assert.equal(order?.cvsStoreName, '市府');
  });

  it('ignores same-timestamp, stale-timestamp, duplicate retries and missing timestamps after a version exists', async () => {
    const store = storeWithProduct();
    await post(store, 'orders/create', orderPayload(), 'wh-create');
    const same = await post(store, 'orders/updated', orderPayload(), 'wh-same');
    assert.equal(same.status, 200);
    assert.equal(same.sync?.ignored, true);
    assert.equal(same.body.decision, 'ignored_stale');
    const stale = await post(
      store,
      'orders/updated',
      orderPayload({ updated_at: '2026-08-31T00:00:00Z', total_price: '999' }),
      'wh-stale',
    );
    assert.equal(stale.status, 200);
    assert.equal(store.getOrder(SHOP, '2001')?.total, 84);
    const duplicate = await post(store, 'orders/create', orderPayload(), 'wh-create');
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.sync?.decision, 'ignored_duplicate');
    const auditsAfterDuplicate = store.audits.length;
    await post(store, 'orders/create', orderPayload(), 'wh-create');
    assert.equal(store.audits.length, auditsAfterDuplicate);
    const missing = await post(
      store,
      'orders/updated',
      orderPayload({ updated_at: null, total_price: '1' }),
      'wh-missing',
    );
    assert.equal(missing.status, 200);
    assert.equal(missing.body.decision, 'ignored_missing_timestamp');
    assert.equal(store.getOrder(SHOP, '2001')?.total, 84);
    assertSafeAudits(store);
  });

  it('allows a missing timestamp only to create the first skeleton', async () => {
    const store = storeWithProduct();
    const first = await post(
      store,
      'orders/create',
      orderPayload({ updated_at: undefined, financial_status: 'pending' }),
      'wh-skeleton',
    );
    assert.equal(first.status, 200);
    assert.equal(first.sync?.created, true);
    assert.equal(store.getOrder(SHOP, '2001')?.paymentStatus, 'unpaid');
    const second = await post(
      store,
      'orders/paid',
      orderPayload({ updated_at: undefined, financial_status: 'paid' }),
      'wh-skeleton-2',
    );
    assert.equal(second.status, 200);
    assert.equal(store.getOrder(SHOP, '2001')?.paymentStatus, 'unpaid');
  });

  it('retries unique conflicts up to 3 times then returns 5xx', async () => {
    const delays: number[] = [];
    const sleep = async (ms: number) => {
      delays.push(ms);
    };
    const successStore = storeWithProduct();
    successStore.createConflictsRemaining = 1;
    const ok = await post(successStore, 'orders/create', orderPayload(), 'wh-retry-ok', sleep);
    assert.equal(ok.status, 200);
    assert.equal(ok.sync?.created, true);
    assert.deepEqual(delays, [50]);

    const failDelays: number[] = [];
    const failStore = storeWithProduct();
    failStore.createConflictsRemaining = 9;
    const failed = await post(failStore, 'orders/paid', orderPayload({ financial_status: 'paid' }), 'wh-retry-fail', async (ms) => {
      failDelays.push(ms);
    });
    assert.equal(failed.status, 500);
    assert.equal(failStore.createAttempts, SHOPIFY_CONFLICT_RETRY_ATTEMPTS);
    assert.deepEqual(failDelays, [50, 100]);
    assert.equal(failStore.getOrder(SHOP, '2001'), null);
  });

  it('upserts concurrent first-seen create and paid onto one order', async () => {
    const store = storeWithProduct();
    const [createResult, paidResult] = await Promise.all([
      post(store, 'orders/create', orderPayload(), 'wh-c'),
      post(
        store,
        'orders/paid',
        orderPayload({ financial_status: 'paid', updated_at: '2026-09-01T01:00:00Z' }),
        'wh-p',
      ),
    ]);
    assert.equal(createResult.status, 200);
    assert.equal(paidResult.status, 200);
    assert.equal(store.orders.size, 1);
    assert.equal(store.getOrder(SHOP, '2001')?.paymentStatus, 'paid');
    assert.equal(store.customerWrites, 0);
    assert.equal(store.shipmentCreates, 0);
  });

  it('returns 4xx without writes for empty items, invalid quantity and malformed money', async () => {
    const emptyStore = storeWithProduct();
    const empty = await post(emptyStore, 'orders/create', orderPayload({ line_items: [] }), 'wh-empty');
    assert.equal(empty.status, 400);
    assert.match(String(empty.body.error), /沒有商品/);
    assert.equal(emptyStore.orders.size, 0);
    assert.equal(emptyStore.audits.length, 0);
    assert.equal(emptyStore.createAttempts, 0);

    const qtyStore = storeWithProduct();
    const invalidQty = await post(
      qtyStore,
      'orders/paid',
      orderPayload({
        financial_status: 'paid',
        line_items: [{ sku: 'CK-30', title: '鴨喉嚨 30g', quantity: 0, price: '84', grams: 30 }],
      }),
      'wh-qty',
    );
    assert.equal(invalidQty.status, 400);
    assert.match(String(invalidQty.body.error), /數量錯誤/);
    assert.equal(qtyStore.orders.size, 0);
    assert.equal(qtyStore.audits.length, 0);

    const moneyStore = storeWithProduct();
    const malformedMoney = await post(
      moneyStore,
      'orders/updated',
      orderPayload({ total_price: 'not-a-price' }),
      'wh-money',
    );
    assert.equal(malformedMoney.status, 400);
    assert.match(String(malformedMoney.body.error), /金額格式錯誤/);
    assert.equal(moneyStore.orders.size, 0);
    assert.equal(moneyStore.audits.length, 0);
    assert.equal(moneyStore.customerWrites, 0);
    assert.equal(moneyStore.inventoryWrites, 0);
    assert.equal(moneyStore.settlementWrites, 0);
  });

  it('rolls back snapshot replacement when an SKU is unknown', async () => {
    const store = storeWithProduct();
    await post(store, 'orders/create', orderPayload(), 'wh-create');
    const auditsBefore = store.audits.length;
    const failed = await post(
      store,
      'orders/updated',
      orderPayload({
        updated_at: '2026-09-01T03:00:00Z',
        line_items: [
          { sku: 'CK-30', title: '鴨喉嚨 30g', quantity: 2, price: '84', grams: 30 },
          { sku: 'UNKNOWN', title: '不存在商品', quantity: 1, price: '10' },
        ],
      }),
      'wh-sku',
    );
    assert.equal(failed.status, 500);
    assert.match(String(failed.body.error), /找不到 Shopify 商品/);
    const order = store.getOrder(SHOP, '2001');
    assert.equal(order?.items.length, 1);
    assert.equal(order?.items[0]?.sku, 'CK-30');
    assert.equal(order?.items[0]?.quantity, 1);
    assert.equal(store.audits.length, auditsBefore);
    assert.equal(store.customerWrites, 0);
    assert.equal(store.inventoryWrites, 0);
    assert.equal(store.settlementWrites, 0);
    assert.equal(store.shipmentCreates, 0);
  });

  it('does not overwrite snapshot after an operational shipment exists, but payment can still advance', async () => {
    const store = storeWithProduct();
    await post(store, 'orders/create', orderPayload(), 'wh-create');
    const seeded = store.getOrder(SHOP, '2001');
    assert.ok(seeded);
    const withShipment: ShopifyOrderRecord = {
      ...seeded,
      shipments: [sampleShipment('pending')],
    };
    store.seedOrder(withShipment);
    const updated = await post(
      store,
      'orders/updated',
      orderPayload({
        financial_status: 'paid',
        updated_at: '2026-09-01T04:00:00Z',
        total_price: '999',
        line_items: [{ sku: 'CK-30', title: '鴨喉嚨 30g', quantity: 9, price: '84', grams: 30 }],
      }),
      'wh-ops',
    );
    assert.equal(updated.status, 200);
    const order = store.getOrder(SHOP, '2001');
    assert.equal(order?.paymentStatus, 'paid');
    assert.equal(order?.total, 84);
    assert.equal(order?.items[0]?.quantity, 1);
    assert.equal(order?.shipments.length, 1);
    assert.equal(store.shipmentCreates, 0);
  });

  it('never resurrects a cancelled order or writes a customer master', async () => {
    const store = storeWithProduct();
    await post(store, 'orders/create', orderPayload(), 'wh-create');
    const seeded = store.getOrder(SHOP, '2001');
    assert.ok(seeded);
    store.seedOrder({ ...seeded, status: 'cancelled', paymentStatus: 'unpaid' });
    const paid = await post(
      store,
      'orders/paid',
      orderPayload({ financial_status: 'paid', updated_at: '2026-09-01T05:00:00Z' }),
      'wh-cancelled-paid',
    );
    assert.equal(paid.status, 200);
    const order = store.getOrder(SHOP, '2001');
    assert.equal(order?.status, 'cancelled');
    assert.equal(order?.paymentStatus, 'paid');
    assert.equal(order?.customerId, null);
    assert.equal(store.customerWrites, 0);
  });

  it('keeps route files as thin verified ingress wrappers', () => {
    const files = [
      ['app/api/shopify/webhooks/orders-create/route.ts', 'orders/create'],
      ['app/api/shopify/webhooks/orders-paid/route.ts', 'orders/paid'],
      ['app/api/shopify/webhooks/orders-updated/route.ts', 'orders/updated'],
    ] as const;
    for (const [file, topic] of files) {
      const src = readFileSync(file, 'utf8');
      assert.match(src, /handleShopifyWebhookRoute/);
      assert.match(src, new RegExp(`'${topic}'`));
      assert.doesNotMatch(src, /JSON\.parse/);
      assert.doesNotMatch(src, /shipment\.create/);
    }
  });
});
