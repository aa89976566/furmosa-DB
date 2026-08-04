import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';
import { assignNewAndComplete } from '@/lib/refill/merchant';
import { RefillError } from '@/lib/refill/errors';
import {
  cleanupFixture,
  createTestPrisma,
  seedCompleteFixture,
} from '@/lib/refill/__tests__/_fixtures';

const hasDb = Boolean(process.env.DIRECT_URL || process.env.DATABASE_URL);

describe('refill complete transaction integration', { skip: !hasDb }, () => {
  const prisma = createTestPrisma();

  after(async () => {
    await prisma.$disconnect();
  });

  it('A. stock fail after old-jar verify rolls back lock/returned/order/stock/new serial', async () => {
    const f = await seedCompleteFixture(prisma, {
      stockQty: 0,
      orderStatus: 'paid_waiting_return',
    });
    try {
      await assert.rejects(
        () =>
          assignNewAndComplete({
            orderId: f.order.id,
            merchantId: f.merchant.id,
            actorId: f.actorId,
            newSerialRaw: f.newCode,
            fulfilledFlavourId: f.flavourB.id,
            oldSerialRaw: f.oldCode,
          }),
        (e: unknown) => e instanceof RefillError && e.code === 'OUT_OF_STOCK',
      );

      const order = await prisma.refillOrder.findUnique({ where: { id: f.order.id } });
      const oldJar = await prisma.jarCode.findUnique({ where: { code: f.oldCode } });
      const newJar = await prisma.jarCode.findUnique({ where: { code: f.newCode } });
      const stockB = await prisma.merchantRefillStock.findUnique({
        where: {
          storeId_flavourId: { storeId: f.store.id, flavourId: f.flavourB.id },
        },
      });
      const txns = await prisma.refillStockTxn.count({
        where: { storeId: f.store.id, reason: 'fulfill' },
      });

      assert.equal(order?.status, 'paid_waiting_return');
      assert.equal(order?.completedAt, null);
      assert.equal(order?.newContainerSerial, null);
      assert.equal(order?.fulfilledFlavourId, null);
      assert.equal(order?.oldContainerSerial, null);
      assert.equal(oldJar?.status, 'issued');
      assert.equal(oldJar?.lockedByRefillOrderId, null);
      assert.equal(newJar?.status, 'unused');
      assert.equal(newJar?.redeemedByCustomerId, null);
      assert.equal(stockB?.quantity, 0);
      assert.equal(txns, 0);
    } finally {
      await cleanupFixture(prisma, f);
    }
  });

  it('B. new serial unique conflict rolls back stock/old jar/order claim', async () => {
    const f = await seedCompleteFixture(prisma, {
      stockQty: 3,
      orderStatus: 'paid_waiting_return',
    });
    // 另一筆已完成訂單占用 newCode
    const other = await prisma.refillOrder.create({
      data: {
        customerId: f.customer.id,
        appointmentId: f.appointment.id,
        merchantId: f.merchant.id,
        orderType: 'first',
        deliveryMode: 'first',
        baseAmount: 129,
        totalAmount: 129,
        status: 'completed',
        paidAt: new Date(),
        completedAt: new Date(),
        newContainerSerial: f.newCode,
        fulfilledFlavourId: f.flavourA.id,
        idempotencyKey: `itest-other:${f.order.id}`,
      },
    });
    try {
      await assert.rejects(
        () =>
          assignNewAndComplete({
            orderId: f.order.id,
            merchantId: f.merchant.id,
            actorId: f.actorId,
            newSerialRaw: f.newCode,
            fulfilledFlavourId: f.flavourB.id,
            oldSerialRaw: f.oldCode,
          }),
        (e: unknown) =>
          e instanceof RefillError && (e.code === 'SERIAL_USED' || e.code === 'INVALID_STATUS'),
      );

      // 若被 P2002 轉成 SERIAL_USED；或在 jar 狀態檢查前撞 unique — 皆須 rollback
      const order = await prisma.refillOrder.findUnique({ where: { id: f.order.id } });
      const oldJar = await prisma.jarCode.findUnique({ where: { code: f.oldCode } });
      const stockB = await prisma.merchantRefillStock.findUnique({
        where: {
          storeId_flavourId: { storeId: f.store.id, flavourId: f.flavourB.id },
        },
      });
      assert.equal(order?.status, 'paid_waiting_return');
      assert.equal(order?.completedAt, null);
      assert.equal(order?.newContainerSerial, null);
      assert.equal(oldJar?.status, 'issued');
      assert.equal(oldJar?.lockedByRefillOrderId, null);
      assert.equal(stockB?.quantity, 3);
    } finally {
      await prisma.refillOrder.delete({ where: { id: other.id } }).catch(() => undefined);
      await cleanupFixture(prisma, f);
    }
  });

  it('C. concurrent complete: only one success, stock -1, old jar returned once', async () => {
    const f = await seedCompleteFixture(prisma, {
      stockQty: 2,
      orderStatus: 'paid_waiting_return',
    });
    try {
      const results = await Promise.allSettled([
        assignNewAndComplete({
          orderId: f.order.id,
          merchantId: f.merchant.id,
          actorId: `${f.actorId}-1`,
          newSerialRaw: f.newCode,
          fulfilledFlavourId: f.flavourB.id,
          oldSerialRaw: f.oldCode,
        }),
        assignNewAndComplete({
          orderId: f.order.id,
          merchantId: f.merchant.id,
          actorId: `${f.actorId}-2`,
          newSerialRaw: f.newCode2,
          fulfilledFlavourId: f.flavourB.id,
          oldSerialRaw: f.oldCode,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      assert.equal(fulfilled.length, 1, `expected 1 success, got ${fulfilled.length}`);
      assert.equal(rejected.length, 1, `expected 1 reject, got ${rejected.length}`);

      const order = await prisma.refillOrder.findUnique({ where: { id: f.order.id } });
      const oldJar = await prisma.jarCode.findUnique({ where: { code: f.oldCode } });
      const stockB = await prisma.merchantRefillStock.findUnique({
        where: {
          storeId_flavourId: { storeId: f.store.id, flavourId: f.flavourB.id },
        },
      });
      const audits = await prisma.refillAuditLog.count({
        where: { refillOrderId: f.order.id, action: 'refill_completed' },
      });
      const issuedNews = await prisma.jarCode.count({
        where: {
          code: { in: [f.newCode, f.newCode2] },
          status: 'issued',
          redeemedByCustomerId: f.customer.id,
        },
      });

      assert.equal(order?.status, 'completed');
      assert.ok(order?.newContainerSerial);
      assert.equal(order?.fulfilledFlavourId, f.flavourB.id);
      assert.equal(order?.preferredFlavourId, f.flavourA.id);
      assert.equal(oldJar?.status, 'returned');
      assert.equal(stockB?.quantity, 1);
      assert.equal(audits, 1);
      assert.equal(issuedNews, 1);
    } finally {
      await cleanupFixture(prisma, f);
    }
  });
});
