import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadSalmonStockSource, SALMON_STOCK } from '../salmon-stock-source.ts';

// Fixed production identities are allowed only inside CI's disposable localhost database.
const local = /@(localhost|127\.0\.0\.1):\d+\/(ci|hq_bulk_test)(\?|$)/.test(process.env.DATABASE_URL ?? '');
test('real HQ order posting consumes 50g once and source never double reserves', { skip: !local }, async () => {
  const db = new PrismaClient();
  let created = false;
  let orderId: string | undefined;
  try {
    const wh = await db.warehouse.upsert({ where: { code: 'WH-MAIN' }, update: {}, create: { code: 'WH-MAIN', name: 'CI HQ' } });
    await db.product.create({ data: { id: SALMON_STOCK.productId, productId: randomUUID(), sku: randomUUID(), name: 'CI salmon',
      category: 'treats', unit: 'g', price: 250, priceTiers: { create: { id: SALMON_STOCK.tierId, weightGrams: 50,
        unit: 'g', unitQty: 1, price: 250, cost: 100, sku: SALMON_STOCK.sku, shopifySku: SALMON_STOCK.sku,
        shopifyVariantId: '64882303271289', inventoryPolicy: 'shared' } },
      inventoryBalances: { create: { warehouseId: wh.id, quantity: 100, unit: 'g', lastCountedAt: new Date() } } } });
    created = true;
    assert.equal((await loadSalmonStockSource(db)).available, 2);
    const order = await db.order.create({ data: { orderNumber: randomUUID(), source: 'manual', hqInventoryEligible: true,
      subtotal: 250, total: 250, items: { create: { productId: SALMON_STOCK.productId, sku: SALMON_STOCK.sku,
        productName: 'CI salmon', quantity: 1, weightGrams: 50, variantKey: SALMON_STOCK.tierId, unit: '包', unitPrice: 250, subtotal: 250 } } } });
    orderId = order.id;
    const reserved = await loadSalmonStockSource(db);
    assert.equal(reserved.onHandGrams, 100); assert.equal(reserved.outstandingGrams, 50); assert.equal(reserved.available, 1);
    await db.order.update({ where: { id: order.id }, data: { status: 'shipped' } });
    const posted = await loadSalmonStockSource(db);
    assert.equal(posted.onHandGrams, 50); assert.equal(posted.outstandingGrams, 0); assert.equal(posted.available, 1);
    await db.order.update({ where: { id: order.id }, data: { status: 'completed' } });
    assert.equal((await loadSalmonStockSource(db)).onHandGrams, 50);
    await db.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    assert.equal((await loadSalmonStockSource(db)).onHandGrams, 100);
    assert.equal((await loadSalmonStockSource(db)).available, 2);
  } finally {
    if (orderId) await db.order.delete({ where: { id: orderId } });
    if (created) {
      // Reversals must be removed before the original ledger row (Restrict relation).
      await db.inventoryTransaction.deleteMany({ where: { productId: SALMON_STOCK.productId, reversesId: { not: null } } });
      await db.inventoryTransaction.deleteMany({ where: { productId: SALMON_STOCK.productId } });
      await db.product.delete({ where: { id: SALMON_STOCK.productId } });
    }
    await db.$disconnect();
  }
});
