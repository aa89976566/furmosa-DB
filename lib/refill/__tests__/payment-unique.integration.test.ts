import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';
import { initiateRefillPayment } from '@/lib/refill/payment';
import {
  cleanupFixture,
  createTestPrisma,
  seedCompleteFixture,
} from '@/lib/refill/__tests__/_fixtures';

const hasDb = Boolean(process.env.DIRECT_URL || process.env.DATABASE_URL);

describe('refill payment uniqueness integration', { skip: !hasDb }, () => {
  const prisma = createTestPrisma();

  after(async () => {
    await prisma.$disconnect();
  });

  it('concurrent NT$30 topup creates only one active payment', async () => {
    process.env.ECPAY_MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || '2000132';
    process.env.ECPAY_HASH_KEY = process.env.ECPAY_HASH_KEY || 'testHashKey1234567890';
    process.env.ECPAY_HASH_IV = process.env.ECPAY_HASH_IV || 'testHashIV1234567';
    process.env.NEXT_PUBLIC_APP_URL =
      process.env.NEXT_PUBLIC_APP_URL || 'https://example.test';

    const f = await seedCompleteFixture(prisma, {
      orderStatus: 'paid_waiting_return',
    });
    await prisma.refillOrder.update({
      where: { id: f.order.id },
      data: {
        status: 'awaiting_extra_payment',
        missingContainerNote: '顧客未帶空罐，改補差額',
      },
    });

    try {
      const results = await Promise.allSettled([
        initiateRefillPayment({
          orderId: f.order.id,
          customerId: f.customer.id,
          purpose: 'extra_topup',
        }),
        initiateRefillPayment({
          orderId: f.order.id,
          customerId: f.customer.id,
          purpose: 'extra_topup',
        }),
      ]);

      const ok = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{
        paymentOrderId: string;
        amount: number;
      }>[];
      assert.ok(ok.length >= 1);
      // 兩個都應成功拿到同一筆有效 pending（或一個 success + conflict reuse）
      const ids = new Set(ok.map((r) => r.value.paymentOrderId));
      assert.equal(ids.size, 1, `expected single payment id, got ${[...ids].join(',')}`);
      assert.equal(ok[0].value.amount, 30);

      const active = await prisma.paymentOrder.findMany({
        where: {
          refillOrderId: f.order.id,
          purpose: 'extra_topup',
          status: { in: ['pending', 'paid'] },
        },
      });
      assert.equal(active.length, 1);
      assert.equal(active[0].amount, 30);
      assert.equal(active[0].status, 'pending');
    } finally {
      await cleanupFixture(prisma, f);
    }
  });

  it('paid topup cannot create second pending', async () => {
    process.env.ECPAY_MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || '2000132';
    process.env.ECPAY_HASH_KEY = process.env.ECPAY_HASH_KEY || 'testHashKey1234567890';
    process.env.ECPAY_HASH_IV = process.env.ECPAY_HASH_IV || 'testHashIV1234567';
    process.env.NEXT_PUBLIC_APP_URL =
      process.env.NEXT_PUBLIC_APP_URL || 'https://example.test';

    const f = await seedCompleteFixture(prisma, {
      orderStatus: 'paid_waiting_return',
    });
    await prisma.refillOrder.update({
      where: { id: f.order.id },
      data: { status: 'awaiting_extra_payment' },
    });
    await prisma.paymentOrder.create({
      data: {
        refillOrderId: f.order.id,
        purpose: 'extra_topup',
        provider: 'ecpay',
        merchantTradeNo: `XTPAID${Date.now()}`.slice(0, 20),
        amount: 30,
        status: 'paid',
        paidAt: new Date(),
      },
    });

    try {
      await assert.rejects(
        () =>
          initiateRefillPayment({
            orderId: f.order.id,
            customerId: f.customer.id,
            purpose: 'extra_topup',
          }),
        (e: unknown) => (e as { code?: string }).code === 'ALREADY_PAID',
      );
      const active = await prisma.paymentOrder.count({
        where: {
          refillOrderId: f.order.id,
          purpose: 'extra_topup',
          status: { in: ['pending', 'paid'] },
        },
      });
      assert.equal(active, 1);
    } finally {
      await cleanupFixture(prisma, f);
    }
  });
});
