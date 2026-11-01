import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const local = /@(localhost|127\.0\.0\.1):\d+\/(ci|hq_bulk_test)(\?|$)/.test(process.env.DATABASE_URL ?? '');
test('jar shipments consume shared source grams atomically and reverse original ledger once', { skip: !local }, async () => {
  const db = new PrismaClient();
  try {
    const wh = await db.warehouse.upsert({ where: { code: 'WH-MAIN' }, update: {}, create: { code: 'WH-MAIN', name: 'HQ test' } });
    const source = await db.product.create({ data: { productId: randomUUID(), sku: randomUUID(), name: '牛肉單品', category: 'freeze_dried', unit: 'g', price: 100,
      priceTiers: { create: { weightGrams: 40, unit: 'g', price: 100 } }, inventoryBalances: { create: { warehouseId: wh.id, quantity: 1000, unit: 'g', lastCountedAt: new Date() } } } });
    const jar = await db.product.create({ data: { productId: randomUUID(), sku: randomUUID(), name: '牛肉換罐', category: 'freeze_dried', productCategory: 'JAR_EXCHANGE', unit: '條', price: 99,
      inventorySourceProductId: source.id, priceTiers: { create: { weightGrams: 20, unit: 'g', price: 99 } } } });
    await assert.rejects(db.inventoryBalance.create({ data: { productId: jar.id, warehouseId: wh.id, quantity: 50, unit: 'g' } }), /不建立獨立庫存/);
    const balance = () => db.inventoryBalance.findUniqueOrThrow({ where: { productId_warehouseId: { productId: source.id, warehouseId: wh.id } } }).then(row => row.quantity);
    const shipment = await db.shipment.create({ data: { shipmentNumber: randomUUID(), type: 'merchant_restock', items: { create: [
      { productId: jar.id, productName: jar.name, sku: jar.sku, quantity: 2, weightGrams: 20, unit: 'g' },
      { productId: source.id, productName: source.name, sku: source.sku, quantity: 1, weightGrams: 40, unit: 'g' },
    ] } } });
    assert.equal(await balance(), 1000);
    await db.shipment.update({ where: { id: shipment.id }, data: { status: 'packed' } });
    assert.equal(await balance(), 1000);
    await db.shipment.update({ where: { id: shipment.id }, data: { status: 'shipped' } });
    assert.equal(await balance(), 920);
    assert.equal(await db.inventoryBalance.count({ where: { productId: jar.id } }), 0);
    await db.shipment.update({ where: { id: shipment.id }, data: { status: 'delivered' } });
    assert.equal(await balance(), 920);
    const postings = await db.inventoryTransaction.findMany({ where: { reference: `shipment:${shipment.id}`, type: 'sales_out' } });
    assert.equal(postings.length, 2);
    assert.ok(postings.every(row => row.productId === source.id && row.quantity === -40 && row.unit === 'g'));
    // Changing the current mapping must not redirect a historical reversal.
    await db.product.update({ where: { id: jar.id }, data: { inventorySourceProductId: null } });
    await db.shipment.update({ where: { id: shipment.id }, data: { status: 'cancelled' } });
    await db.shipment.update({ where: { id: shipment.id }, data: { status: 'cancelled' } });
    assert.equal(await balance(), 1000);
    assert.equal(await db.inventoryTransaction.count({ where: { reference: `shipment:${shipment.id}`, type: 'return_in' } }), 2);
    const unmapped = await db.shipment.create({ data: { shipmentNumber: randomUUID(), type: 'merchant_restock', items: { create: { productId: jar.id, productName: jar.name, sku: jar.sku, quantity: 2, weightGrams: 20, unit: 'g' } } } });
    await assert.rejects(db.shipment.update({ where: { id: unmapped.id }, data: { status: 'shipped' } }), /庫存來源/);
    assert.equal((await db.shipment.findUniqueOrThrow({ where: { id: unmapped.id } })).status, 'pending');
    assert.equal(await balance(), 1000);
    assert.equal(await db.inventoryTransaction.count({ where: { reference: `shipment:${unmapped.id}` } }), 0);
    await assert.rejects(db.product.update({ where: { id: jar.id }, data: { inventorySourceProductId: jar.id } }));
    await db.product.update({ where: { id: jar.id }, data: { inventorySourceProductId: source.id } });
    await assert.rejects(db.product.update({ where: { id: source.id }, data: { unit: '包' } }));
    const order = await db.order.create({ data: { orderNumber: randomUUID(), subtotal: 0, total: 0, source: 'consignment', merchantOrderMode: 'jar_exchange', status: 'pending', items: { create: { productId: jar.id, productName: jar.name, sku: jar.sku, quantity: 2, unitPrice: 0, subtotal: 0, weightGrams: 20, unit: 'g' } } } });
    await db.order.update({ where: { id: order.id }, data: { status: 'shipped' } });
    assert.equal(await balance(), 960);
    await db.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    assert.equal(await balance(), 1000);
  } finally { await db.$disconnect(); }
});
