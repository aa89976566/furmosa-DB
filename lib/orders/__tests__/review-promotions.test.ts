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

function fakeDb(catalog = [mooncakeProduct], stock = 20) {
  let order: any = { id: 'o1', externalStore: 'test.myshopify.com', externalOrderId: '790',
    omsStatus: 'NEW', status: 'pending_review', shopifySnapshot: snapshot, omsIssueFlags: [], shipments: [],
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
    orderId: 'o1', actorId: 'u1', sourceHash: snapshotHash(snapshot), action, draft, ...overrides,
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
    const f = fakeDb([mooncakeProduct], 20);
    await f.run('check'); await f.run('approve');
    f.setStock(10);
    await assert.rejects(f.run('ship'), /庫存不足/);
    assert.equal(f.shipmentCreates, 0);
    const g = fakeDb([mooncakeProduct], 11);
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
    const g = fakeDb();
    await g.run('check'); await g.run('approve');
    const original = mooncakeProduct.priceTiers[0].weightGrams;
    mooncakeProduct.priceTiers[0].weightGrams = 100;
    await assert.rejects(g.run('ship'), /出貨計畫|規格|CK-08|重新檢查/);
    mooncakeProduct.priceTiers[0].weightGrams = original;
  });

  it('does not create a shipment during check/approve and keeps unpaid review allowed', () => {
    const unpaid = shopifySnapshot({ ...snapshot.order, financial_status: 'pending', id: snapshot.order.id });
    const result = checkReview(unpaid, draft, [{ ...mooncakeProduct, available: 20 }], false);
    assert.ok(result.issues.some(issue => issue.code === 'PAYMENT_PENDING'));
    assert.equal(result.plan.items.length, 2);
  });
});
