import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { recordCounterSale } from '../record-counter-sale';
import type { loadCounterCatalog } from '../counter-catalog';

// Explicit, ephemeral CI database only; never fall back to runtime credentials.
const ciUrl = 'postgresql://ci:ci@127.0.0.1:5432/ci';
const isolated = process.env.CI === 'true' && process.env.INVENTORY_TEST_DATABASE_URL === ciUrl;
test('counter sale retries preserve exact stock, tier and financial snapshots', { skip: !isolated }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: ciUrl } } });
  const stamp = randomUUID();
  try {
    const merchant = await db.merchant.create({ data: { merchantId: stamp, name: 'CI replay', type: 'consignment' } });
    const product = await db.product.create({ data: { productId: stamp, sku: stamp, name: 'CI replay', price: 195, unit: '包' } });
    for (const tierId of ['30', '50']) await db.merchantStock.create({ data: { merchantId: merchant.id, productId: product.id, tierId, quantity: 3 } });
    const catalog = (async () => ({ priced: ['30', '50'].map(tierId => ({
      productId: product.id, tierId, name: product.name, price: 195,
      priceTiers: [{ price: 195 }], suggestedPrice: 195,
      commissionMode: 'percent', commissionValue: 30, stock: 3, unitPrice: 195,
    })) })) as unknown as typeof loadCounterCatalog;
    const lines = [{ productId: product.id, tierId: '30', qty: 1 }];
    const quantity = async (tierId = '30') => (await db.merchantStock.findUniqueOrThrow({ where: {
      merchantId_productId_tierId: { merchantId: merchant.id, productId: product.id, tierId },
    } })).quantity;
    const key = randomUUID();
    const first = await recordCounterSale(merchant.id, lines, key, db, catalog);
    // A lost response can be replayed without charging or decrementing again.
    assert.deepEqual(await recordCounterSale(merchant.id, lines, key, db, catalog), first);
    assert.equal(await quantity(), 2);
    await assert.rejects(recordCounterSale(merchant.id, [{ ...lines[0]!, qty: 2 }], key, db, catalog), /內容不同/);
    await assert.rejects(recordCounterSale(merchant.id, lines, '', db, catalog), /結帳識別/);
    const concurrentKey = randomUUID();
    const results = await Promise.all([1, 2, 3].map(() => recordCounterSale(merchant.id, lines, concurrentKey, db, catalog)));
    assert.deepEqual(results, [first, first, first]);
    assert.equal(await quantity(), 1);
    assert.equal(await quantity('50'), 3, 'other tier must remain untouched');
    const ledger = await db.merchantStockTxn.findMany({ where: { merchantId: merchant.id, productId: product.id } });
    assert.equal(ledger.length, 2);
    for (const row of ledger) {
      assert.equal(row.tierId, '30'); assert.equal(row.quantity, -1);
      assert.equal(row.unitPrice, 195); assert.equal(row.commissionAmount, 58.5);
      assert.equal(row.companyRevenue, 136.5);
    }
    // Same-key retry succeeds even if the catalog no longer contains that item.
    const emptyCatalog = (async () => ({ priced: [] })) as unknown as typeof loadCounterCatalog;
    assert.deepEqual(await recordCounterSale(merchant.id, lines, key, db, emptyCatalog), first);
    const failureKey = randomUUID();
    const failingDb = { $transaction: (fn: Parameters<PrismaClient['$transaction']>[0], options: unknown) =>
      db.$transaction(async tx => (fn as unknown as (tx: unknown) => Promise<unknown>)(new Proxy(tx, {
        get(target, field) {
          if (field === 'statusAuditLog') return { findUnique: target.statusAuditLog.findUnique.bind(target.statusAuditLog), create: async () => { throw new Error('CI receipt failure'); } };
          return Reflect.get(target, field);
        },
      })), options as never),
    } as unknown as PrismaClient;
    await assert.rejects(recordCounterSale(merchant.id, lines, failureKey, failingDb, catalog), /CI receipt failure/);
    assert.equal(await quantity(), 1, 'receipt failure rolls back stock');
    assert.equal(await db.merchantStockTxn.count({ where: { merchantId: merchant.id } }), 2);
    await recordCounterSale(merchant.id, lines, failureKey, db, catalog);
    assert.equal(await quantity(), 0, 'a new valid ticket may sell the final item');
    assert.deepEqual(await recordCounterSale(merchant.id, lines, failureKey, db, emptyCatalog), first);
    assert.equal(await db.merchantStockTxn.count({ where: { merchantId: merchant.id } }), 3);
    assert.equal(await db.statusAuditLog.count({ where: { actorId: merchant.id, entityType: 'pos_counter_sale' } }), 3);
  } finally {
    // Keep immutable records; CI destroys its disposable PostgreSQL container.
    await db.$disconnect();
  }
});
