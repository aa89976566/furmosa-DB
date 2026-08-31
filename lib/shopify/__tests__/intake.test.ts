import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import type { Prisma, PrismaClient } from '@prisma/client';
import { guardLegacyOrderTx } from '../legacy-gate';
import { intakeSummary, shopifySnapshot, snapshotHash, intakePaymentStatus, preserveOperationalOrder } from '../intake-policy';
import { persistShopifyIntake, type IntakeEvent } from '../intake';
import { shopifyWebhookHandler } from '../webhook-handler';
import { snapshotView } from '../snapshot-view';

const raw = { id: '90071992547409931234', name: '#TEST', currency: 'TWD',
  created_at: '2026-08-30T00:00:00Z', updated_at: '2026-08-30T01:00:00Z',
  financial_status: 'pending', subtotal_price: '100.10', total_discounts: '0.00', total_price: '160.10',
  total_shipping_price_set: { shop_money: { amount: '60.00' } },
  line_items: [{ sku: 'UNKNOWN-SKU', title: '測試品項', quantity: 1, price: '100.10' }],
};
const input = (overrides = {}, eventId = 'event-1'): IntakeEvent => ({
  shopDomain: 'test.myshopify.com', topic: 'orders/create', eventId,
  snapshot: shopifySnapshot({ ...raw, ...overrides }),
});

// In-memory transaction contract double; not proof of PostgreSQL locking/migration behavior.
function fakeDb() {
  type Row = Record<string, any>;
  const orders = new Map<string, Row>();
  const events = new Map<string, Row>();
  let failOrder = false;
  let tail = Promise.resolve();
  let lockCalls = 0;
  const key = (where: Row) => JSON.stringify(where.shopDomain_topic_eventId);
  const eventApi = {
    findUnique: async ({ where }: Row) => events.get(key(where)) ?? null,
    upsert: async ({ where, create, update }: Row) => {
      const previous = events.get(key(where));
      const value = previous ? { ...previous, ...update,
        attempts: update.attempts?.increment ? previous.attempts + update.attempts.increment : previous.attempts } :
        { id: `e${events.size}`, status: 'RECEIVED', ...create };
      events.set(key(where), value); return value;
    },
    update: async ({ where, data }: Row) => {
      const entry = [...events].find(([, value]) => value.id === where.id)!;
      events.set(entry[0], { ...entry[1], ...data });
    },
  };
  const tx = {
    $executeRaw: async () => { lockCalls++; return 1; },
    shopifyWebhookEvent: eventApi,
    order: {
      findUnique: async ({ where }: Row) => [...orders.values()].find(value =>
        value.externalStore === where.externalStore_externalOrderId.externalStore &&
        value.externalOrderId === where.externalStore_externalOrderId.externalOrderId) ?? null,
      create: async ({ data }: Row) => {
        if (failOrder) throw new Error('PRIVATE_DB_ERROR');
        const value = { id: `o${orders.size}`, ...data }; orders.set(value.id, value); return value;
      },
      update: async ({ where, data }: Row) => {
        const value = { ...orders.get(where.id), ...data }; orders.set(where.id, value); return value;
      },
    },
    statusAuditLog: { create: async () => ({}) },
  };
  const db = { shopifyWebhookEvent: eventApi, $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise(resolve => { release = resolve; });
    await previous;
    const oldOrders = structuredClone(orders), oldEvents = structuredClone(events);
    try { return await fn(tx); }
    catch (error) {
      orders.clear(); events.clear();
      for (const [k, v] of oldOrders) orders.set(k, v);
      for (const [k, v] of oldEvents) events.set(k, v);
      throw error;
    } finally { release(); }
  } } as unknown as PrismaClient;
  return { db, orders, events, fail: () => { failOrder = true; }, recover: () => { failOrder = false; }, locks: () => lockCalls };
}

describe('Shopify intake', () => {
  it('reconcile leaves pre-existing legacy orders unchanged under the order lock', async () => {
    const fake = fakeDb();
    await persistShopifyIntake(fake.db, input());
    const order = [...fake.orders.values()][0]; order.omsStatus = null; order.status = 'shipped';
    const before = structuredClone(order);
    const result = await persistShopifyIntake(fake.db, { ...input({ financial_status: 'paid' }, 'reconcile-test'), origin: 'reconcile' });
    assert.equal(result.disposition, 'legacy'); assert.deepEqual([...fake.orders.values()][0], before);
  });
  it('preserves every unknown/missing SKU without requiring products or payment', async () => {
    const fake = fakeDb();
    const event = input({ line_items: [...raw.line_items, { title: '無 SKU', quantity: 2 }] });
    assert.equal((await persistShopifyIntake(fake.db, event)).created, true);
    const order = [...fake.orders.values()][0];
    assert.equal(order.omsStatus, 'NEW'); assert.equal(order.paymentStatus, 'unpaid');
    assert.equal(order.shopifySnapshot.order.line_items.length, 2);
    assert.equal(order.externalOrderId, raw.id); assert.equal(order.items, undefined);
    assert.equal(order.total, 160.10); assert.equal(fake.locks(), 1);
    assert.ok(order.omsIssueFlags.some((issue: any) => issue.code === 'SKU_MISSING'));
    assert.equal([...fake.events.values()][0].status, 'PROCESSED');
  });
  it('deduplicates repeat/concurrent calls and never creates a Shipment', async () => {
    const fake = fakeDb();
    await Promise.all([persistShopifyIntake(fake.db, input()), persistShopifyIntake(fake.db, input())]);
    assert.equal(fake.orders.size, 1); assert.equal(fake.events.size, 1);
    assert.equal((await persistShopifyIntake(fake.db, input())).disposition, 'duplicate');
  });
  it('updates paid on the same order, ignores older unpaid updates', async () => {
    const fake = fakeDb(); await persistShopifyIntake(fake.db, input());
    await persistShopifyIntake(fake.db, { ...input({ updated_at: '2026-08-30T02:00:00Z', financial_status: 'paid' }, 'paid'), topic: 'orders/paid' });
    assert.equal(fake.orders.size, 1); assert.equal([...fake.orders.values()][0].paymentStatus, 'paid');
    assert.equal([...fake.orders.values()][0].omsStatus, 'NEW');
    assert.equal((await persistShopifyIntake(fake.db, input({}, 'late'))).disposition, 'stale');
    assert.equal([...fake.orders.values()][0].paymentStatus, 'paid');
  });
  it('quarantines conflicting timestamps rather than overwriting payment', async () => {
    const fake = fakeDb(); await persistShopifyIntake(fake.db, input());
    const result = await persistShopifyIntake(fake.db, input({ financial_status: 'paid' }, 'conflict'));
    assert.equal(result.disposition, 'conflict');
    assert.equal([...fake.orders.values()][0].paymentStatus, 'unpaid');
    assert.equal([...fake.events.values()][1].lastErrorCode, 'SOURCE_VERSION_CONFLICT');
  });
  it('detects event id reuse with changed content', async () => {
    const fake = fakeDb(); await persistShopifyIntake(fake.db, input());
    await assert.rejects(() => persistShopifyIntake(fake.db, input({ total_price: '999' })), /EVENT_ID_CONFLICT/);
    assert.equal([...fake.orders.values()][0].total, 160.10);
    assert.equal([...fake.events.values()][0].status, 'PROCESSED');
  });
  it('preserves shipped operational state when a refund arrives', async () => {
    const fake = fakeDb(); await persistShopifyIntake(fake.db, input());
    const order = [...fake.orders.values()][0]; order.status = 'shipped'; order.omsStatus = 'FULFILLED';
    await persistShopifyIntake(fake.db, input({ updated_at: '2026-08-30T03:00:00Z', financial_status: 'refunded', total_price: '0.00' }, 'refund'));
    const next = [...fake.orders.values()][0];
    assert.equal(next.status, 'shipped'); assert.equal(next.omsStatus, 'FULFILLED');
    assert.equal(next.total, 160.10); assert.equal(next.paymentStatus, 'refunded');
  });
  it('records a failed transaction and permits redelivery to recover', async () => {
    const fake = fakeDb(); fake.fail();
    await assert.rejects(() => persistShopifyIntake(fake.db, input()), /INTAKE_FAILED/);
    assert.equal(fake.orders.size, 0); assert.equal([...fake.events.values()][0].status, 'FAILED');
    fake.recover(); await persistShopifyIntake(fake.db, input());
    assert.equal(fake.orders.size, 1); assert.equal([...fake.events.values()][0].status, 'PROCESSED');
  });
  it('minimizes snapshots, preserves exact string IDs, quarantines invalid money', () => {
    const snapshot = shopifySnapshot({ ...raw, token: 'SECRET', client_details: { ip: 'PRIVATE' },
      note_attributes: [{ name: 'password', value: 'SECRET' }, { name: 'cvs_store_id', value: '123' }] });
    assert.doesNotMatch(JSON.stringify(snapshot), /SECRET|PRIVATE/);
    assert.equal(snapshot.order.id, raw.id);
    assert.throws(() => shopifySnapshot({ ...raw, id: Number.MAX_SAFE_INTEGER + 1 }));
    const summary = intakeSummary(shopifySnapshot({ ...raw, total_price: 'not-money' }));
    assert.equal(summary.total, 0); assert.ok(summary.issues.some(issue => issue.message.includes('總額格式')));
    assert.equal(snapshotView(snapshot)?.items[0].sku, 'UNKNOWN-SKU');
    assert.equal(snapshotHash(snapshot), snapshotHash(shopifySnapshot({ ...raw, note_attributes: [{ name: 'cvs_store_id', value: '123' }] })));
  });
  it('does not equate authorization/partial payment with paid', () => {
    for (const status of ['authorized', 'pending', 'partially_paid', 'partially_refunded', 'refunded', 'voided']) {
      assert.notEqual(intakePaymentStatus(status), 'paid');
    }
    assert.equal(preserveOperationalOrder({ status: 'cancelled', fulfillmentStatus: 'pending', omsStatus: null }), true);
  });
});

describe('Shopify webhook HTTP boundary', () => {
  const body = JSON.stringify(raw), secret = 'synthetic-test-secret';
  function request(headers: Record<string, string> = {}) {
    return new Request('https://example.test/api/shopify/webhooks/orders-create', { method: 'POST', body,
      headers: { 'x-shopify-hmac-sha256': createHmac('sha256', secret).update(body).digest('base64'),
        'x-shopify-topic': 'orders/create', 'x-shopify-shop-domain': 'test.myshopify.com', ...headers } });
  }
  it('rejects invalid signatures, shops and topics before persistence', async () => {
    let calls = 0;
    const handler = shopifyWebhookHandler('orders/create', { secret: () => secret, domain: () => 'test.myshopify.com',
      persist: async () => { calls++; return { created: true, disposition: 'saved' }; } });
    assert.equal((await handler(request({ 'x-shopify-hmac-sha256': 'bad' }))).status, 401);
    assert.equal((await handler(request({ 'x-shopify-shop-domain': 'other.myshopify.com' }))).status, 403);
    assert.equal((await handler(request({ 'x-shopify-topic': '' }))).status, 400);
    assert.equal(calls, 0);
    assert.equal((await handler(request())).status, 200); assert.equal(calls, 1);
  });
  it('returns 503 without configuration or failed persistence, without leaking errors', async () => {
    const handler = shopifyWebhookHandler('orders/create', { secret: () => secret, domain: () => 'test.myshopify.com',
      persist: async () => { throw new Error('SECRET_DATABASE_URL'); } });
    const result = await handler(request()); assert.equal(result.status, 503);
    assert.doesNotMatch(await result.text(), /SECRET_DATABASE_URL/);
    const unconfigured = shopifyWebhookHandler('orders/create', { secret: () => secret, domain: () => '',
      persist: async () => { throw new Error('should not run'); } });
    assert.equal((await unconfigured(request())).status, 503);
  });
  it('accepts unpaid payloads on paid/update routes and uses stable fallback identity', async () => {
    const keys: string[] = [];
    for (const topic of ['orders/paid', 'orders/updated'] as const) {
      const handler = shopifyWebhookHandler(topic, { secret: () => secret, domain: () => 'test.myshopify.com',
        persist: async event => { keys.push(event.eventId); return { created: false, disposition: 'saved' }; } });
      assert.equal((await handler(request({ 'x-shopify-topic': topic }))).status, 200);
    }
    assert.equal(keys[0], keys[1]); assert.match(keys[0], /^body:/);
  });
});

describe('legacy mutation gate', () => {
  it('locks before re-reading OMS enrollment, rejecting concurrent intake', async () => {
    const calls: string[] = [];
    const tx = { order: { findUnique: async () => {
      calls.push('read'); return calls.length === 1 ? { externalStore: 'test.myshopify.com', externalOrderId: '1' } : { omsStatus: 'NEW' };
    } }, $executeRaw: async () => { calls.push('lock'); } } as unknown as Prisma.TransactionClient;
    await assert.rejects(() => guardLegacyOrderTx(tx, 'order'), /OMS/);
    assert.deepEqual(calls, ['read', 'lock', 'read']);
  });
  it('does not enroll or block an unrelated legacy order', async () => {
    const tx = { order: { findUnique: async () => ({ externalStore: null, externalOrderId: null, omsStatus: null }) } } as unknown as Prisma.TransactionClient;
    await assert.doesNotReject(() => guardLegacyOrderTx(tx, 'legacy'));
  });
  it('fails closed when an order no longer exists', async () => {
    const tx = { order: { findUnique: async () => null } } as unknown as Prisma.TransactionClient;
    await assert.rejects(() => guardLegacyOrderTx(tx, 'missing'), /不存在/);
  });
});
