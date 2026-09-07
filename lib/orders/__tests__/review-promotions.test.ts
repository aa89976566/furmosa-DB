import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { shopifySnapshot, snapshotHash } from '../../shopify/intake-policy';
import { MOONCAKE_CATALOG } from '../../products/mooncake-catalog';
import { FULFILLMENT_PLAN_VERSION } from '../fulfillment-plan';
import { checkReview, reviewDraft, type ReviewDraft } from '../review-policy';
import { runReview } from '../review-service';

const mooncakeProduct = {
  id: 'ck08', name: MOONCAKE_CATALOG.name, sku: 'CK-08', sourceSku: 'CK-08', status: 'active',
  productCategory: 'STANDARD', cost: 30, unit: '顆', defaultTemperature: 'frozen',
  priceTiers: [{ id: 't50', weightGrams: 50, unit: '顆', unitQty: 1, cost: 30 }],
  inventoryBalances: [{ quantity: 20 }],
};
const feed = {
  id: 'feed', name: '飼料', sku: 'FD-01', sourceSku: 'FD-01', status: 'active',
  productCategory: 'STANDARD', cost: 10, unit: '包', defaultTemperature: 'ambient', priceTiers: [],
  inventoryBalances: [{ quantity: 20 }],
};

function paidCk08(qty = 10) {
  return shopifySnapshot({
    id: '790', currency: 'TWD', created_at: '2026-09-01T00:00:00+08:00', updated_at: '2026-09-01T01:00:00+08:00',
    financial_status: 'paid', subtotal_price: '790.00', total_discounts: '0.00', total_price: '790.00',
    total_shipping_price_set: { shop_money: { amount: '0.00' } },
    line_items: [{ sku: 'CK-08', title: '月餅', quantity: qty, price: '79.00', requires_shipping: true }],
  });
}

const snapshot = paidCk08(10);
const draft: ReviewDraft = reviewDraft({
  lines: [{ productId: 'ck08', temperature: 'frozen' }],
  method: 'home', temperature: 'frozen', recipient: '測試', phone: '0912345678', address: '地址',
  giftsConfirmed: true,
});

function cloneMooncake(overrides: Record<string, unknown> = {}) {
  return {
    ...mooncakeProduct,
    priceTiers: mooncakeProduct.priceTiers.map(tier => ({ ...tier })),
    inventoryBalances: [{ quantity: 20 }],
    ...overrides,
  };
}

function fakeDb(catalog = [cloneMooncake()], stock = 20, source = snapshot, form: ReviewDraft = draft) {
  let order: any = { id: 'o1', externalStore: 'test.myshopify.com', externalOrderId: '790',
    omsStatus: 'NEW', status: 'pending_review', shopifySnapshot: source, omsIssueFlags: [], shipments: [],
    shopifySourceUpdatedAt: new Date('2026-09-01T01:00:00+08:00'), orderedAt: new Date('2026-09-01T00:00:00+08:00'), total: 790 };
  const audits: any[] = [];
  let shipmentCreates = 0;
  const createdItems: any[] = [];
  const createdShipmentItems: any[] = [];
  const catalogWithStock = () => catalog.map(product => ({
    ...product,
    inventoryBalances: [{ quantity: product.id === 'ck08' ? stock : (product.inventoryBalances?.[0]?.quantity ?? 20) }],
  }));
  const reservations: { productId: string; quantity: number }[] = [];
  const tx: any = {
    $executeRaw: async () => 1,
    user: { findUnique: async () => ({ id: 'u1', role: 'staff' }) },
    order: { findUnique: async () => order, findUniqueOrThrow: async () => order,
      findFirst: async () => null, update: async ({ data }: any) => { order = { ...order, ...data }; return order; } },
    product: { findMany: async ({ where }: any) => {
      const rows = catalogWithStock();
      const or = where?.OR as Record<string, unknown>[] | undefined;
      if (!or) return rows;
      return rows.filter(product => or.some(condition => {
        if (condition.id && Array.isArray((condition.id as { in?: string[] }).in)) return (condition.id as { in: string[] }).in.includes(product.id);
        if (condition.sku) return product.sku === condition.sku;
        if (condition.sourceSku) return product.sourceSku === condition.sourceSku;
        return false;
      }));
    } },
    shipmentItem: { groupBy: async () => reservations.map(row => ({ productId: row.productId, _sum: { quantity: row.quantity } })) },
    orderItem: { deleteMany: async () => ({}), createMany: async ({ data }: any) => { createdItems.push(...data); return {}; } },
    shipment: { create: async ({ data }: any) => {
      shipmentCreates++;
      createdShipmentItems.push(...(data.items?.create ?? []));
      order.shipments.push({ shipmentNumber: data.shipmentNumber, items: data.items?.create ?? [] });
      return data;
    } },
    statusAuditLog: { findFirst: async () => audits.filter(a => a.entityType === 'oms_review').at(-1) ?? null,
      create: async ({ data }: any) => { const a = { id: `a${audits.length}`, ...data }; audits.push(a); return a; } },
  };
  const db = { $transaction: async (fn: any) => fn(tx) } as PrismaClient;
  const run = (action: 'check' | 'approve' | 'ship', overrides = {}) => runReview(db, {
    orderId: 'o1', actorId: 'u1', sourceHash: snapshotHash(source), action, draft: form, ...overrides,
  });
  return { run, get order() { return order; }, get shipmentCreates() { return shipmentCreates; },
    createdItems, createdShipmentItems, audits, setStock: (n: number) => { stock = n; },
    reserve: (productId: string, quantity: number) => { reservations.push({ productId, quantity }); } };
}

describe('review promotions contract', () => {
  it('check, approve and ship stay idempotent and write 10+1 at 50g', async () => {
    const f = fakeDb();
    await f.run('check'); await f.run('approve');
    await f.run('ship'); await f.run('ship');
    assert.equal(f.shipmentCreates, 1);
    assert.equal(f.createdItems.length, 2);
    assert.equal(f.createdItems[0].quantity, 10);
    assert.equal(f.createdItems[1].quantity, 1);
    assert.equal(f.createdItems[1].isGift, true);
    assert.equal(f.createdItems[1].unitPrice, 0);
    assert.equal(f.createdItems[1].weightGrams, 50);
    assert.equal(f.createdItems[1].unit, '顆');
    assert.equal(f.createdShipmentItems.reduce((sum, item) => sum + item.quantity, 0), 11);
    assert.equal(f.createdShipmentItems[1].weightGrams, 50);
    const saved = JSON.parse(f.audits[0].metadataJson);
    assert.equal(saved.schemaVersion, 1);
    assert.equal(saved.planVersion, FULFILLMENT_PLAN_VERSION);
    assert.ok(saved.fulfillmentPlan);
  });

  it('blocks shipping when stock is 10 for a 10+1 plan, including reserved quantity', async () => {
    const f = fakeDb([cloneMooncake()], 20);
    await f.run('check'); await f.run('approve');
    f.setStock(10);
    await assert.rejects(f.run('ship'), /庫存不足/);
    assert.equal(f.shipmentCreates, 0);
    const g = fakeDb([cloneMooncake()], 11);
    await g.run('check'); await g.run('approve');
    g.reserve('ck08', 1);
    await assert.rejects(g.run('ship'), /庫存不足/);
  });

  it('requires a new check when the saved plan is missing or the catalog identity changes', async () => {
    const f = fakeDb();
    await f.run('check');
    const saved = JSON.parse(f.audits[0].metadataJson);
    delete saved.fulfillmentPlan;
    f.audits[0].metadataJson = JSON.stringify(saved);
    f.order.omsStatus = 'REVIEW';
    await assert.rejects(f.run('approve'), /出貨計畫/);
    const catalog = [cloneMooncake()];
    const g = fakeDb(catalog);
    await g.run('check'); await g.run('approve');
    catalog[0].priceTiers[0].weightGrams = 100;
    await assert.rejects(g.run('ship'), /出貨計畫|規格|CK-08|重新檢查/);
  });

  it('does not create a shipment during check/approve and keeps unpaid review allowed', () => {
    const unpaid = shopifySnapshot({ ...snapshot.order, financial_status: 'pending', id: snapshot.order.id });
    const result = checkReview(unpaid, draft, [{ ...cloneMooncake(), available: 20 }], false);
    assert.ok(result.issues.some(issue => issue.code === 'PAYMENT_PENDING'));
    assert.equal(result.plan.items.length, 2);
  });

  it('allows unpaid check and approve through the service, but blocks ship', async () => {
    const unpaid = shopifySnapshot({ ...snapshot.order, financial_status: 'pending', id: snapshot.order.id });
    const f = fakeDb([cloneMooncake()], 20, unpaid);
    await f.run('check');
    assert.equal(f.order.omsStatus, 'REVIEW');
    await f.run('approve');
    assert.equal(f.order.omsStatus, 'READY');
    await assert.rejects(f.run('ship'), /付款/);
    assert.equal(f.shipmentCreates, 0);
  });

  it('ships source gifts at 0/50g/顆 for both free and fully-discounted lines', async () => {
    const giftDraft = reviewDraft({
      lines: [{ productId: 'ck08', temperature: 'frozen' }, { productId: 'ck08', temperature: 'frozen' }],
      method: 'home', temperature: 'frozen', recipient: '測試', phone: '0912345678', address: '地址',
      giftsConfirmed: true,
    });
    const free = shopifySnapshot({
      ...snapshot.order,
      line_items: [
        { sku: 'CK-08', quantity: 10, price: '79.00', requires_shipping: true },
        { sku: 'CK-08', variant_id: '64368368517497', quantity: 1, price: '0.00', requires_shipping: true },
      ],
    });
    const f = fakeDb([cloneMooncake()], 20, free, giftDraft);
    await f.run('check'); await f.run('approve'); await f.run('ship');
    assert.equal(f.createdItems.length, 2);
    assert.equal(f.createdItems.reduce((sum, item) => sum + item.quantity, 0), 11);
    const freeGift = f.createdItems.find(item => item.isGift);
    assert.equal(freeGift?.unitPrice, 0);
    assert.equal(freeGift?.weightGrams, 50);
    assert.equal(freeGift?.unit, '顆');

    const discounted = shopifySnapshot({
      ...snapshot.order,
      line_items: [
        { sku: 'CK-08', quantity: 10, price: '79.00', requires_shipping: true },
        { sku: 'CK-08', variant_id: '64368368517497', quantity: 1, price: '79.00', total_discount: '79.00', requires_shipping: true },
      ],
    });
    const g = fakeDb([cloneMooncake()], 20, discounted, giftDraft);
    await g.run('check'); await g.run('approve'); await g.run('ship');
    assert.equal(g.createdItems.reduce((sum, item) => sum + item.quantity, 0), 11);
    assert.equal(g.createdItems.find(item => item.isGift)?.unitPrice, 0);
  });

  it('requires recheck for tier, cost, catalog temperature and old plan versions; stock-only still uses live stock', async () => {
    const drift = async (mutate: (product: ReturnType<typeof cloneMooncake>) => void) => {
      const product = cloneMooncake();
      const f = fakeDb([product]);
      await f.run('check'); await f.run('approve');
      mutate(product);
      await assert.rejects(f.run('ship'), /出貨計畫/);
      assert.equal(f.shipmentCreates, 0);
    };
    await drift(product => { product.priceTiers[0].id = 'replacement'; });
    await drift(product => { product.priceTiers[0].cost = 99; });
    await drift(product => { product.defaultTemperature = 'ambient'; });

    const version = fakeDb([cloneMooncake()]);
    await version.run('check');
    const saved = JSON.parse(version.audits[0].metadataJson);
    saved.fulfillmentPlan.planVersion = 'ck08-555-plan-v1';
    version.audits[0].metadataJson = JSON.stringify(saved);
    version.order.omsStatus = 'REVIEW';
    await assert.rejects(version.run('approve'), /出貨計畫/);

    const stockOnly = fakeDb([cloneMooncake()], 20);
    await stockOnly.run('check'); await stockOnly.run('approve');
    stockOnly.setStock(11);
    await stockOnly.run('ship');
    assert.equal(stockOnly.shipmentCreates, 1);
    assert.equal(stockOnly.createdItems.reduce((sum, item) => sum + item.quantity, 0), 11);
  });
});
