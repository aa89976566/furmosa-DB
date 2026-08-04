import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

export function createTestPrisma() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('INTEGRATION_SKIP: missing DATABASE_URL/DIRECT_URL');
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

export async function seedCompleteFixture(prisma: PrismaClient, opts?: {
  stockQty?: number;
  orderStatus?: 'paid_waiting_return' | 'old_container_verified';
  withOldLock?: boolean;
}) {
  const stockQty = opts?.stockQty ?? 5;
  const orderStatus = opts?.orderStatus ?? 'paid_waiting_return';
  const suffix = randomUUID().replace(/-/g, '');
  const merchantCode = `MER-${suffix.slice(0, 12)}`.toUpperCase();
  const slug = merchantToStoreSlug(merchantCode);

  const customer = await prisma.customer.create({
    data: {
      customerId: `furmosa-t-${suffix}`,
      name: `測試會員-${suffix}`,
      type: 'individual',
    },
  });

  const merchant = await prisma.merchant.create({
    data: {
      merchantId: merchantCode,
      name: `測試店-${suffix}`,
      type: 'jar_exchange',
      types: ['jar_exchange'],
      status: 'active',
    },
  });

  const store = await prisma.store.create({
    data: {
      id: `store_${slug}`,
      name: merchant.name,
      slug,
      secretToken: `t${suffix}`.slice(0, 6),
    },
  });

  const flavourA = await prisma.refillFlavour.create({
    data: {
      id: randomUUID(),
      code: `fa_${suffix}`,
      name: '口味A',
      weightGrams: 50,
      isActive: true,
      sortOrder: 1,
    },
  });
  const flavourB = await prisma.refillFlavour.create({
    data: {
      id: randomUUID(),
      code: `fb_${suffix}`,
      name: '口味B',
      weightGrams: 50,
      isActive: true,
      sortOrder: 2,
    },
  });

  await prisma.merchantRefillStock.createMany({
    data: [
      {
        id: randomUUID(),
        storeId: store.id,
        flavourId: flavourA.id,
        quantity: stockQty,
        isAvailable: true,
      },
      {
        id: randomUUID(),
        storeId: store.id,
        flavourId: flavourB.id,
        quantity: stockQty,
        isAvailable: true,
      },
    ],
  });

  const starts = new Date(Date.now() + 3 * 24 * 3600 * 1000);
  const ends = new Date(starts.getTime() + 3600 * 1000);
  const appointment = await prisma.appointment.create({
    data: {
      merchantId: merchant.id,
      customerId: customer.id,
      serviceName: '美容',
      petName: 'Milo',
      startsAt: starts,
      endsAt: ends,
      status: 'confirmed',
      createdBy: 'hq',
      confirmedAt: new Date(),
    },
  });

  const oldCode = String(80000000 + Math.floor(Math.random() * 9999999)).padStart(8, '0');
  const newCode = String(81000000 + Math.floor(Math.random() * 9999999)).padStart(8, '0');
  const newCode2 = String(82000000 + Math.floor(Math.random() * 9999999)).padStart(8, '0');

  await prisma.jarCode.createMany({
    data: [
      {
        code: oldCode,
        status: 'issued',
        redeemedByCustomerId: customer.id,
        issuedAt: new Date(),
        issuedMerchantId: merchant.id,
        lockedByRefillOrderId: null,
      },
      { code: newCode, status: 'unused' },
      { code: newCode2, status: 'unused' },
    ],
  });

  const order = await prisma.refillOrder.create({
    data: {
      customerId: customer.id,
      appointmentId: appointment.id,
      merchantId: merchant.id,
      petName: 'Milo',
      preferredFlavourId: flavourA.id,
      orderType: 'exchange',
      deliveryMode: 'exchange',
      baseAmount: 99,
      extraAmount: 0,
      totalAmount: 99,
      status: orderStatus,
      paidAt: new Date(),
      oldContainerSerial: orderStatus === 'old_container_verified' ? oldCode : null,
      idempotencyKey: `itest:${suffix}`,
    },
  });

  if (opts?.withOldLock || orderStatus === 'old_container_verified') {
    await prisma.jarCode.update({
      where: { code: oldCode },
      data: { lockedByRefillOrderId: order.id },
    });
  }

  await prisma.paymentOrder.create({
    data: {
      refillOrderId: order.id,
      purpose: 'refill',
      provider: 'ecpay',
      merchantTradeNo: `RF${suffix}`.slice(0, 20),
      amount: 99,
      status: 'paid',
      paidAt: new Date(),
    },
  });

  return {
    customer,
    merchant,
    store,
    flavourA,
    flavourB,
    appointment,
    order,
    oldCode,
    newCode,
    newCode2,
    actorId: `actor-${suffix}`,
  };
}

export async function cleanupFixture(
  prisma: PrismaClient,
  f: Awaited<ReturnType<typeof seedCompleteFixture>>,
) {
  await prisma.refillAuditLog.deleteMany({ where: { refillOrderId: f.order.id } });
  await prisma.refillStockTxn.deleteMany({ where: { storeId: f.store.id } });
  await prisma.paymentOrder.deleteMany({ where: { refillOrderId: f.order.id } });
  await prisma.memberPointsLedger.deleteMany({ where: { customerId: f.customer.id } });
  await prisma.refillOrder.deleteMany({ where: { id: f.order.id } });
  await prisma.jarCode.deleteMany({
    where: { code: { in: [f.oldCode, f.newCode, f.newCode2] } },
  });
  await prisma.appointment.deleteMany({ where: { id: f.appointment.id } });
  await prisma.merchantRefillStock.deleteMany({ where: { storeId: f.store.id } });
  await prisma.refillFlavour.deleteMany({
    where: { id: { in: [f.flavourA.id, f.flavourB.id] } },
  });
  await prisma.store.deleteMany({ where: { id: f.store.id } });
  await prisma.merchant.deleteMany({ where: { id: f.merchant.id } });
  await prisma.customer.deleteMany({ where: { id: f.customer.id } });
}
