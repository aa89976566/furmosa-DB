import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { confirmMerchantRestockReceipt } from '@/lib/merchant-restock-receipt';
import { recordCounterSale } from '../record-counter-sale';
import type { loadCounterCatalog } from '../counter-catalog';

let isolated: string | undefined;
try {
  const url = new URL(process.env.INVENTORY_TEST_DATABASE_URL ?? '');
  if (['localhost', '127.0.0.1'].includes(url.hostname) && ['ci', 'inventory_test'].includes(url.pathname.slice(1))) isolated = url.href;
} catch { /* No runtime database fallback. */ }

test('HQ dispatch → merchant receipt → POS sale: real stock, replay, concurrent retry and atomic rollback', { skip: !isolated }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: isolated! } } });
  const tag = randomUUID();
  try {
    const warehouse = await db.warehouse.upsert({ where: { code: 'WH-MAIN' }, update: {}, create: { code: 'WH-MAIN', name: 'CI warehouse' } });
    const product = await db.product.create({ data: { productId: tag, sku: tag, name: 'CI 30g', unit: 'g', price: 100,
      priceTiers: { create: { weightGrams: 30, unit: 'g', price: 100 } },
      inventoryBalances: { create: { warehouseId: warehouse.id, quantity: 1000, unit: 'g', lastCountedAt: new Date() } },
    }, include: { priceTiers: true } });
    const tier = product.priceTiers[0]!;
    const merchant = await db.merchant.create({ data: { merchantId: tag, name: 'CI merchant' } });
    const operator = await db.merchantUser.create({ data: { merchantId: merchant.id, username: tag, passwordHash: 'CI-not-a-login', isActive: false } });
    const shipment = await db.shipment.create({ data: { shipmentNumber: tag, type: 'merchant_restock', merchantId: merchant.id,
      items: { create: { productId: product.id, productName: product.name, sku: product.sku, quantity: 2, weightGrams: 30, unit: 'g', variantKey: tier.id } },
    } });
    const hq = async () => (await db.inventoryBalance.findUniqueOrThrow({ where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } } })).quantity;
    const shop = async () => (await db.merchantStock.findUniqueOrThrow({ where: { merchantId_productId_tierId: { merchantId: merchant.id, productId: product.id, tierId: tier.id } } })).quantity;
    const saleCount = () => db.merchantStockTxn.count({ where: { merchantId: merchant.id, type: 'sale' } });
    assert.equal(await hq(), 1000);
    await db.shipment.update({ where: { id: shipment.id }, data: { status: 'shipped' } });
    await db.shipment.update({ where: { id: shipment.id }, data: { status: 'shipped' } });
    assert.equal(await hq(), 940);
    const receipt = { shipmentId: shipment.id, merchantId: merchant.id, merchantUserId: operator.id };
    assert.equal(await confirmMerchantRestockReceipt(receipt, db), 'just_received');
    assert.equal(await confirmMerchantRestockReceipt(receipt, db), 'already_received');
    assert.equal(await shop(), 2);
    assert.equal(await hq(), 940);
    // Deliberately stale catalog: the ledger must use the actual post-write balance.
    const catalog = (async () => ({ merchantName: merchant.name, items: [], categories: [], priced: [{ productId: product.id, tierId: tier.id, name: product.name,
      price: 100, priceTiers: [{ price: 100 }], suggestedPrice: 100, commissionMode: 'percent', commissionValue: 20, stock: 2,
    }] })) as typeof loadCounterCatalog;
    const lines = [{ productId: product.id, tierId: tier.id, qty: 1 }];
    const key = randomUUID();
    const retry = await Promise.all([1, 2].map(() => recordCounterSale(merchant.id, lines, key, db, catalog)));
    assert.deepEqual(retry, [{ total: 100, lineCount: 1 }, { total: 100, lineCount: 1 }]);
    assert.equal(await shop(), 1);
    assert.equal(await saleCount(), 1);
    await assert.rejects(recordCounterSale(merchant.id, [{ ...lines[0]!, qty: 2 }], key, db, catalog), /內容不同/);
    const failKey = randomUUID();
    const failingDb = { $transaction: (run: (tx: unknown) => Promise<unknown>, options: unknown) => db.$transaction(tx => run(new Proxy(tx, { get(target, field) {
      if (field === 'statusAuditLog') return new Proxy(target.statusAuditLog, { get(delegate, method) {
        if (method === 'create') return async () => { throw new Error('CI receipt failure'); };
        return Reflect.get(delegate, method);
      } });
      return Reflect.get(target, field);
    } })), options as never) } as unknown as PrismaClient;
    await assert.rejects(recordCounterSale(merchant.id, lines, failKey, failingDb, catalog), /CI receipt failure/);
    assert.equal(await shop(), 1);
    assert.equal(await saleCount(), 1);
    await recordCounterSale(merchant.id, lines, failKey, db, catalog);
    assert.equal(await shop(), 0);
    const sales = await db.merchantStockTxn.findMany({ where: { merchantId: merchant.id, type: 'sale' }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(sales.map(row => row.balanceAfter), [1, 0]);
    assert.equal(sales.reduce((sum, row) => sum + (row.companyRevenue ?? 0), 0), 160);
    const noCatalog = (async () => { throw new Error('Replay must not reload catalog'); }) as typeof loadCounterCatalog;
    await recordCounterSale(merchant.id, lines, failKey, db, noCatalog);
    await assert.rejects(recordCounterSale(merchant.id, lines, randomUUID(), db, catalog), /庫存不足/);
    assert.equal(await saleCount(), 2);
    assert.equal(await hq(), 940, 'POS sales must never deduct HQ a second time');
  } finally { await db.$disconnect(); }
});
