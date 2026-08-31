import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { shopifySnapshot, snapshotHash } from '../../shopify/intake-policy';
import { checkReview, reviewDraft, type ReviewDraft } from '../review-policy';
import { runReview } from '../review-service';

const raw = { id: '123', currency: 'TWD', updated_at: '2026-08-30T01:00:00Z', financial_status: 'paid',
  subtotal_price: '100.10', total_discounts: '0.00', total_price: '160.10',
  total_shipping_price_set: { shop_money: { amount: '60.00' } },
  line_items: [{ sku: 'A', title: '商品', quantity: 1, price: '100.10', requires_shipping: true }],
};
const snapshot = shopifySnapshot(raw);
const draft: ReviewDraft = { lines: [{ productId: 'p1', temperature: 'ambient' }], method: 'home', temperature: 'ambient',
  recipient: '測試', phone: '0912345678', address: '測試地址', storeId: '', storeName: '', giftsConfirmed: true, duplicateConfirmed: false };
const products = [{ id: 'p1', name: '商品', sku: 'A', status: 'active', available: 2 }];
const codes = (source = snapshot, data = draft, stock = products, duplicate = false) => checkReview(source, data, stock, duplicate).issues.map(i => i.code);

describe('OMS review checks', () => {
  it('accepts mapped paid physical orders and preserves cents', () => {
    const result = checkReview(snapshot, draft, products, false);
    assert.deepEqual(result.issues, []); assert.equal(result.items[0].subtotal, 100.1);
  });
  it('blocks all non-paid states and cancellation', () => {
    for (const financial_status of ['pending', 'authorized', 'partially_paid', 'refunded', 'partially_refunded', 'voided']) {
      assert.ok(codes(shopifySnapshot({ ...raw, financial_status })).some(c => c.startsWith('PAYMENT_')));
    }
    assert.ok(codes(shopifySnapshot({ ...raw, cancelled_at: '2026-08-30T02:00:00Z' })).includes('ORDER_CANCELLED'));
    assert.ok(codes(shopifySnapshot({ ...raw, fulfillment_status: 'fulfilled' })).includes('ORDER_CHANGED'));
    assert.ok(codes(shopifySnapshot({ ...raw, fulfillment_status: 'partial' })).includes('ORDER_CHANGED'));
  });
  it('requires mapping, known stock and aggregate quantity availability', () => {
    assert.ok(codes(snapshot, { ...draft, lines: [] }).includes('PRODUCT_UNMAPPED'));
    assert.ok(codes(snapshot, draft, [{ ...products[0], available: null }] as any).includes('STOCK_UNKNOWN'));
    const source = shopifySnapshot({ ...raw, line_items: [raw.line_items[0], { ...raw.line_items[0], quantity: 2 }] });
    assert.ok(codes(source, { ...draft, lines: [draft.lines[0], draft.lines[0]] }).includes('STOCK_INSUFFICIENT'));
  });
  it('does not trust quantities, amounts, boolean strings or incomplete forms', () => {
    for (const quantity of [-1, 0, 0.5, '1', 2147483648]) assert.ok(codes(shopifySnapshot({ ...raw, line_items: [{ ...raw.line_items[0], quantity }] })).includes('ORDER_CHANGED'));
    for (const price of ['NaN', '-1', '1.001', 12]) assert.ok(codes(shopifySnapshot({ ...raw, line_items: [{ ...raw.line_items[0], price }] })).includes('ORDER_CHANGED'));
    assert.equal(reviewDraft({ giftsConfirmed: 'true' }).giftsConfirmed, false);
    assert.ok(codes(snapshot, reviewDraft({})).length > 3);
  });
  it('blocks missing contacts, pickup store and incompatible temperatures', () => {
    const result = codes(snapshot, { ...draft, recipient: '', phone: '', address: '', method: 'convenience', temperature: 'frozen' });
    for (const c of ['RECIPIENT_MISSING', 'PHONE_MISSING', 'ADDRESS_MISSING', 'PICKUP_STORE_MISSING', 'TEMPERATURE_CONFLICT']) assert.ok(result.includes(c as any));
  });
  it('requires gifts and possible duplicate acknowledgment', () => {
    assert.ok(codes(snapshot, { ...draft, giftsConfirmed: false }, products, true).includes('GIFT_REVIEW_REQUIRED'));
    assert.ok(codes(snapshot, draft, products, true).includes('POSSIBLE_DUPLICATE'));
    assert.deepEqual(codes(snapshot, { ...draft, duplicateConfirmed: true }, products, true), []);
  });
});

// Contract double only: real PostgreSQL lock, rollback and concurrent stock tests require isolated DB.
function fakeDb() {
  let order: any = { id: 'o1', externalStore: 'test.myshopify.com', externalOrderId: '123',
    omsStatus: 'NEW', status: 'pending_review', shopifySnapshot: snapshot, omsIssueFlags: [], shipments: [],
    shopifySourceUpdatedAt: new Date(raw.updated_at), orderedAt: new Date(raw.updated_at), total: 160.1 };
  const audits: any[] = [];
  let stock = 2, role = 'staff', shipmentCreates = 0;
  const tx: any = {
    $executeRaw: async () => 1,
    user: { findUnique: async () => ({ id: 'u1', role }) },
    order: { findUnique: async () => order, findUniqueOrThrow: async () => order,
      findFirst: async () => null, update: async ({ data }: any) => { order = { ...order, ...data }; return order; } },
    product: { findMany: async () => [{ ...products[0], productCategory: 'STANDARD', inventoryBalances: [{ quantity: stock }], priceTiers: [] }] },
    shipmentItem: { groupBy: async () => [] },
    orderItem: { deleteMany: async () => ({}), createMany: async () => ({}) },
    shipment: { create: async ({ data }: any) => { shipmentCreates++; order.shipments.push(data); return data; } },
    statusAuditLog: { findFirst: async () => audits.filter(a => a.entityType === 'oms_review').at(-1) ?? null,
      create: async ({ data }: any) => { const a = { id: `a${audits.length}`, ...data }; audits.push(a); return a; } },
  };
  const db = { $transaction: async (fn: any) => fn(tx) } as PrismaClient;
  const run = (action: 'check' | 'approve' | 'ship', overrides = {}) => runReview(db, {
    orderId: 'o1', actorId: 'u1', sourceHash: snapshotHash(snapshot), action, draft, ...overrides,
  });
  return { run, get order() { return order; }, get shipmentCreates() { return shipmentCreates; },
    setStock: (n: number) => { stock = n; }, setRole: (value: string) => { role = value; } };
}
describe('OMS review transaction contract', () => {
  it('check and approval never create shipment; separate ship is idempotent', async () => {
    const f = fakeDb(); await f.run('check'); assert.equal(f.order.omsStatus, 'REVIEW');
    await f.run('approve'); assert.equal(f.order.omsStatus, 'READY'); assert.equal(f.order.omsReviewedById, 'u1');
    assert.equal(f.shipmentCreates, 0);
    await f.run('ship'); await f.run('ship'); assert.equal(f.shipmentCreates, 1); assert.equal(f.order.omsStatus, 'FULFILLMENT_PENDING');
  });
  it('rejects direct shipping, unauthorized users, stale versions and unsaved forms', async () => {
    const f = fakeDb(); await assert.rejects(f.run('ship'));
    f.setRole('warehouse'); await assert.rejects(f.run('check'), /審核權限/); f.setRole('staff');
    await assert.rejects(f.run('check', { sourceHash: 'old' }), /已更新/);
    await f.run('check'); await assert.rejects(f.run('approve', { draft: { ...draft, address: '另一地址' } }), /已修改/);
    assert.equal(f.shipmentCreates, 0);
  });
  it('rechecks stock after approval and never bypasses unresolved source conflicts', async () => {
    const f = fakeDb(); await f.run('check'); await f.run('approve'); f.setStock(0);
    await assert.rejects(f.run('ship'), /庫存不足/); assert.equal(f.shipmentCreates, 0);
    const g = fakeDb(); g.order.omsIssueFlags = [{ code: 'SOURCE_VERSION_UNKNOWN', severity: 'blocking', message: '版本衝突' }];
    await assert.rejects(g.run('check'), /版本不明或衝突/);
  });
});
