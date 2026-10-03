import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { shopifySnapshot, snapshotHash } from '../../shopify/intake-policy';
import { checkReview, reviewDraft, type ReviewDraft } from '../review-policy';
import { ReviewError, runReview } from '../review-service';
import { mergeShopifyFulfillmentDraft, shopifySourceDraft } from '../shopify-source-review';

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
  it('keeps Shopify product lines authoritative while accepting HQ fulfillment corrections', () => {
    const source = shopifySnapshot({ ...raw,
      shipping_address: { name: '原收件人', phone: '0911111111', city: '台北市', address1: '原地址' },
      shipping_lines: [{ title: '一般配送', code: 'HOME' }],
    });
    const sourceDraft = shopifySourceDraft(source, products as any);
    const corrected = mergeShopifyFulfillmentDraft(sourceDraft, reviewDraft({
      ...draft,
      method: 'convenience',
      recipient: '補正收件人',
      phone: '0922222222',
      address: '補正門市地址',
      storeId: '123456',
      storeName: '測試門市',
      lines: [{ productId: 'untrusted-product', temperature: 'frozen' }],
    }));
    assert.equal(corrected.lines[0]?.productId, sourceDraft.lines[0]?.productId);
    assert.equal(corrected.lines[0]?.temperature, 'ambient');
    assert.equal(corrected.method, 'convenience');
    assert.equal(corrected.recipient, '補正收件人');
    assert.equal(corrected.phone, '0922222222');
    assert.equal(corrected.address, '補正門市地址');
    assert.equal(corrected.storeId, '123456');
    assert.equal(corrected.storeName, '測試門市');
  });

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
  it('blocks missing contacts, pickup store name and incompatible temperatures', () => {
    const result = codes(snapshot, { ...draft, recipient: '', phone: '', address: '', method: 'convenience', temperature: 'frozen' });
    for (const c of ['RECIPIENT_MISSING', 'PHONE_MISSING', 'ADDRESS_MISSING', 'PICKUP_STORE_MISSING', 'TEMPERATURE_CONFLICT']) assert.ok(result.includes(c as any));
    const namedStore = codes(snapshot, { ...draft, method: 'convenience', temperature: 'ambient', storeId: '', storeName: '測試門市' });
    assert.equal(namedStore.includes('PICKUP_STORE_MISSING'), false);
  });
  it('uses deterministic promotion checks and only asks for duplicate acknowledgment when needed', () => {
    assert.equal(codes(snapshot, { ...draft, giftsConfirmed: false }, products, false).includes('GIFT_REVIEW_REQUIRED'), false);
    assert.ok(codes(snapshot, draft, products, true).includes('POSSIBLE_DUPLICATE'));
    assert.deepEqual(codes(snapshot, { ...draft, duplicateConfirmed: true }, products, true), []);
  });
});

// Contract double only: real PostgreSQL lock, rollback and concurrent stock tests require isolated DB.
function fakeDb(source = snapshot) {
  let order: any = { id: 'o1', externalStore: 'test.myshopify.com', externalOrderId: '123',
    omsStatus: 'NEW', status: 'pending_review', shopifySnapshot: source, omsIssueFlags: [], shipments: [],
    shopifySourceUpdatedAt: new Date(raw.updated_at), orderedAt: new Date(raw.updated_at), total: 160.1 };
  const audits: any[] = [];
  let stock = 2, role = 'staff', shipmentCreates = 0;
  const tx: any = {
    $executeRaw: async () => 1,
    user: { findUnique: async () => ({ id: 'u1', role }) },
    order: { findUnique: async () => order, findUniqueOrThrow: async () => order,
      findFirst: async () => null, update: async ({ data }: any) => { order = { ...order, ...data }; return order; } },
    product: { findMany: async () => [{ ...products[0], productCategory: 'STANDARD', inventoryBalances: [{ quantity: stock }], priceTiers: [] }] },
    shipmentItem: { findMany: async () => [] },
    orderItem: { deleteMany: async () => ({}), createMany: async () => ({}) },
    shipment: {
      create: async ({ data }: any) => {
        shipmentCreates++;
        const row = { id: `s${shipmentCreates}`, createdAt: new Date(), status: data.status ?? 'pending', ...data };
        order.shipments.push(row);
        return row;
      },
      findFirst: async () => [...order.shipments].reverse().find((row: any) => row.status !== 'cancelled') ?? null,
    },
    statusAuditLog: { findFirst: async () => audits.filter(a => a.entityType === 'oms_review').at(-1) ?? null,
      create: async ({ data }: any) => { const a = { id: `a${audits.length}`, ...data }; audits.push(a); return a; } },
  };
  const db = { $transaction: async (fn: any) => fn(tx) } as PrismaClient;
  const run = (action: 'check' | 'approve' | 'ship', overrides = {}) => runReview(db, {
    orderId: 'o1', actorId: 'u1', sourceHash: snapshotHash(source), action, draft, ...overrides,
  });
  return { run, get order() { return order; }, get shipmentCreates() { return shipmentCreates; },
    get audits() { return audits; },
    setStock: (n: number) => { stock = n; }, setRole: (value: string) => { role = value; } };
}
describe('OMS review transaction contract', () => {
  it('accepts a 7-11 store name without a store number in source-only review', async () => {
    const source = shopifySnapshot({ ...raw,
      shipping_address: { name: '測試', phone: '0912345678', city: '台北市', address1: '門市地址' },
      shipping_lines: [{ title: '7-11', code: '711' }],
    });
    const f = fakeDb(source);
    const result = await f.run('check', {
      sourceOnly: true,
      draft: { ...draft, method: 'convenience', storeId: '', storeName: '昌順門市' },
    });
    assert.equal(result.blockers.some(message => message.includes('六位數') || message.includes('門市店號')), false);
  });

  it('Shopify source review accepts a source product without an HQ mapping or temperature override', async () => {
    const source = shopifySnapshot({ ...raw,
      shipping_address: { name: '測試', phone: '0912345678', city: '台北市', address1: '測試地址' },
      shipping_lines: [{ title: '一般配送', code: 'HOME' }],
      line_items: [{ ...raw.line_items[0], sku: 'SHOPIFY-ONLY' }],
    });
    const f = fakeDb(source);
    const result = await f.run('check', { sourceOnly: true, draft: { ...draft, lines: [], temperature: '', method: '' } });
    assert.equal(result.ok, true);
    assert.equal(result.blockers.some(message => message.includes('對應有效商品') || message.includes('溫層')), false);
  });

  it('deleted orders cannot be checked, approved or shipped', async () => {
    const f = fakeDb(); f.order.deletedAt = new Date();
    for (const action of ['check', 'approve', 'ship'] as const) await assert.rejects(f.run(action), /已從 HQ 刪除/);
    assert.equal(f.shipmentCreates, 0);
  });
  it('keeps the legacy two-step contract when sourceOnly is false', async () => {
    const f = fakeDb(); await f.run('check'); assert.equal(f.order.omsStatus, 'REVIEW');
    await f.run('approve'); assert.equal(f.order.omsStatus, 'READY'); assert.equal(f.order.omsReviewedById, 'u1');
    assert.equal(f.shipmentCreates, 0);
    await f.run('ship'); await f.run('ship'); assert.equal(f.shipmentCreates, 1); assert.equal(f.order.omsStatus, 'FULFILLMENT_PENDING');
  });

  it('source-only paid approval is atomic and creates the shipment before leaving review', async () => {
    const f = fakeDb();
    const formDraft = { ...draft, lines: [], temperature: '' };
    await f.run('check', { sourceOnly: true, draft: formDraft });
    const approved = await f.run('approve', { sourceOnly: true, draft: formDraft });
    assert.equal(approved.ok, true);
    assert.equal(approved.action, 'ship');
    assert.equal(approved.omsStatus, 'FULFILLMENT_PENDING');
    assert.equal(f.order.omsStatus, 'FULFILLMENT_PENDING');
    assert.equal(f.shipmentCreates, 1);
    assert.equal(approved.next?.href, '/shipments?s=s1');
  });

  it('repeated source-only approve is idempotent after shipment creation', async () => {
    const f = fakeDb();
    const formDraft = { ...draft, lines: [], temperature: '' };
    await f.run('check', { sourceOnly: true, draft: formDraft });
    const first = await f.run('approve', { sourceOnly: true, draft: formDraft });
    const second = await f.run('approve', { sourceOnly: true, draft: formDraft });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.action, 'ship');
    assert.equal(second.omsStatus, 'FULFILLMENT_PENDING');
    assert.equal(second.next?.href, '/shipments?s=s1');
    assert.equal(f.shipmentCreates, 1);
  });

  it('normalizes server-derived temperature before comparing approve form', async () => {
    const f = fakeDb();
    const formDraft = { ...draft, lines: [], temperature: '' };
    await f.run('check', { sourceOnly: true, draft: formDraft });
    const approved = await f.run('approve', { sourceOnly: true, draft: formDraft });
    assert.equal(approved.ok, true);
    assert.equal(approved.omsStatus, 'FULFILLMENT_PENDING');
  });

  it('source-only approve accepts an empty submitted product-line payload because lines are server-owned', async () => {
    const f = fakeDb();
    const formDraft = { ...draft, lines: [], temperature: '' };
    await f.run('check', { sourceOnly: true, draft: formDraft });
    const approved = await f.run('approve', { sourceOnly: true, draft: formDraft });
    assert.equal(approved.ok, true);
    assert.equal(approved.omsStatus, 'FULFILLMENT_PENDING');
    assert.equal(f.shipmentCreates, 1);
  });

  it('source-only approval stays in REVIEW when shipment validation fails', async () => {
    const f = fakeDb();
    await f.run('check', { sourceOnly: true });
    f.setStock(0);
    await assert.rejects(f.run('approve', { sourceOnly: true }), /庫存不足/);
    assert.equal(f.order.omsStatus, 'REVIEW');
    assert.equal(f.shipmentCreates, 0);
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

const unpaidSnapshot = shopifySnapshot({ ...raw, financial_status: 'pending' });
function serializable(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

describe('OMS review action result contract', () => {
  it('returns a serializable approve result with READY and shipping CTA', async () => {
    const f = fakeDb();
    const checked = await f.run('check');
    assert.equal(checked.ok, true);
    assert.equal(checked.action, 'check');
    assert.equal(checked.omsStatus, 'REVIEW');
    assert.equal(checked.kind, 'success');
    assert.deepEqual(serializable(checked), checked);
    const approved = await f.run('approve');
    assert.equal(approved.ok, true);
    assert.equal(approved.action, 'approve');
    assert.equal(approved.message, '已確認訂單');
    assert.equal(approved.omsStatus, 'READY');
    assert.equal(approved.kind, 'success');
    assert.deepEqual(approved.blockers, []);
    assert.deepEqual(approved.next, { label: '前往運送資訊', href: '#oms-shipping' });
    assert.deepEqual(serializable(approved), approved);
  });

  it('classifies a saved check with blocking issues as blocked, not success', async () => {
    const incomplete = { ...draft, recipient: '', phone: '', address: '' };
    const blockedDb = fakeDb();
    const blocked = await blockedDb.run('check', { draft: incomplete });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.kind, 'blocked');
    assert.equal(blocked.action, 'check');
    assert.equal(blocked.omsStatus, 'REVIEW');
    assert.equal(blockedDb.order.omsStatus, 'REVIEW');
    assert.equal(blocked.message, '已儲存，請處理上方列出的問題後重新檢查');
    assert.ok(Array.isArray(blocked.blockers) && blocked.blockers.length >= 2);
    assert.deepEqual(serializable(blocked), blocked);
    const passed = await fakeDb().run('check');
    assert.equal(passed.ok, true);
    assert.equal(passed.kind, 'success');
    assert.equal(passed.message, '檢查通過，可以確認訂單');
    assert.deepEqual(passed.blockers, []);
  });

  it('lets unpaid orders become READY and reports payment still pending', async () => {
    const f = fakeDb(unpaidSnapshot);
    await f.run('check');
    const approved = await f.run('approve');
    assert.equal(approved.ok, true);
    assert.equal(f.order.omsStatus, 'READY');
    assert.equal(approved.message, '已確認訂單');
    assert.ok(approved.blockers.includes('等待 Shopify 付款完成'));
    assert.ok(approved.blockers.includes('Shopify 付款完成後訂單會回到待審核，需重新檢查並確認'));
    assert.equal(approved.kind, 'success');
    assert.deepEqual(approved.next, { label: '前往運送資訊', href: '#oms-shipping' });
    assert.deepEqual(serializable(approved), approved);
  });

  it('treats a second approve as success without writing data', async () => {
    const f = fakeDb();
    await f.run('check');
    const first = await f.run('approve');
    const reviewedAt = f.order.omsReviewedAt;
    const reviewedBy = f.order.omsReviewedById;
    const auditCount = f.audits.length;
    const again = await f.run('approve');
    assert.equal(first.ok, true);
    assert.equal(again.ok, true);
    assert.equal(again.action, 'approve');
    assert.equal(again.omsStatus, 'READY');
    assert.equal(f.order.omsReviewedAt, reviewedAt);
    assert.equal(f.order.omsReviewedById, reviewedBy);
    assert.equal(f.audits.length, auditCount);
    assert.equal(f.shipmentCreates, 0);
  });

  it('returns ok true for a duplicate ship and keeps a single shipment', async () => {
    const f = fakeDb();
    await f.run('check');
    await f.run('approve');
    const first = await f.run('ship');
    const second = await f.run('ship');
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.action, 'ship');
    assert.equal(second.omsStatus, 'FULFILLMENT_PENDING');
    assert.equal(second.message, '訂單已確認並已有出貨單');
    assert.equal(f.shipmentCreates, 1);
    assert.deepEqual(serializable(second), second);
  });

  it('keeps multiple blockers as an array instead of joining them', async () => {
    const incomplete = { ...draft, recipient: '', phone: '', address: '' };
    const f = fakeDb();
    await f.run('check', { draft: incomplete });
    await assert.rejects(f.run('approve', { draft: incomplete }), (error: unknown) => {
      assert.ok(error instanceof ReviewError);
      assert.equal(error.kind, 'blocked');
      assert.ok(Array.isArray(error.blockers) && error.blockers.length >= 2);
      assert.equal(error.message.includes('；'), false);
      return true;
    });
  });

  it('classifies stale hash, unsaved edits and stock as structured errors', async () => {
    const stale = fakeDb();
    await assert.rejects(stale.run('check', { sourceHash: 'old' }), (error: unknown) => {
      assert.ok(error instanceof ReviewError);
      assert.equal(error.kind, 'error');
      assert.deepEqual(error.blockers, []);
      assert.match(error.message, /已更新/);
      return true;
    });
    const unsaved = fakeDb();
    await unsaved.run('check');
    await assert.rejects(unsaved.run('approve', { draft: { ...draft, address: '另一地址' } }), (error: unknown) => {
      assert.ok(error instanceof ReviewError);
      assert.equal(error.kind, 'blocked');
      assert.deepEqual(error.blockers, []);
      assert.match(error.message, /已修改/);
      return true;
    });
    const stock = fakeDb();
    await stock.run('check');
    await stock.run('approve');
    stock.setStock(0);
    await assert.rejects(stock.run('ship'), (error: unknown) => {
      assert.ok(error instanceof ReviewError);
      assert.equal(error.kind, 'blocked');
      assert.ok(Array.isArray(error.blockers) && error.blockers.some(item => item.includes('庫存不足')));
      return true;
    });
    assert.equal(stock.shipmentCreates, 0);
  });
});


test('infers convenience shipping from a saved store name when Shopify method is blank', () => {
  const merged = mergeShopifyFulfillmentDraft(
    reviewDraft({ method: '', storeName: '', storeId: '', recipient: 'A', phone: '0912345678', address: 'X' }),
    reviewDraft({ method: '', storeName: '昌順門市', storeId: '', recipient: 'A', phone: '0912345678', address: 'X' }),
  );
  assert.equal(merged.method, 'convenience');
  assert.equal(merged.storeName, '昌順門市');
});


it('uses product default temperature for shipping when Shopify has no temperature label', () => {
  const source = shopifySnapshot({
    ...raw,
    shipping_address: { name: '測試', phone: '0912345678', city: '台北市', address1: '測試地址' },
    shipping_lines: [{ title: '一般配送', code: 'HOME' }],
  });
  const sourceDraft = shopifySourceDraft(source, [{
    ...products[0],
    sourceSku: null,
    defaultTemperature: 'ambient',
    available: 2,
  }] as any);
  assert.equal(sourceDraft.temperature, 'ambient');
  assert.equal(sourceDraft.lines[0]?.temperature, 'ambient');
});
