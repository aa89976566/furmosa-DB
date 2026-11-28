import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { prisma } from '@/lib/prisma';
import { initiateRefillPayment } from '@/lib/refill/payment';

const ENV_KEYS = [
  'APP_ENV',
  'EXTERNAL_EFFECTS_MODE',
  'ECPAY_MERCHANT_ID',
  'ECPAY_HASH_KEY',
  'ECPAY_HASH_IV',
  'ECPAY_PAYMENT_URL',
  'ECPAY_RETURN_URL',
  'ECPAY_ORDER_RESULT_URL',
  'NEXT_PUBLIC_APP_URL',
] as const;

const oldEnv = new Map<string, string | undefined>();
const originalTransaction = prisma.$transaction;
type TransactionMock = (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;

const topup = { orderId: 'refill-1', customerId: 'customer-1', purpose: 'extra_topup' } as const;

function mockTopup() {
  const order = {
    id: topup.orderId,
    customerId: topup.customerId,
    merchantId: 'merchant-1',
    status: 'awaiting_extra_payment',
    orderType: 'exchange',
    deliveryMode: 'exchange',
    paidAt: new Date(),
    baseAmount: 99,
    totalAmount: 99,
    extraAmount: 0,
  };
  type PaymentData = { merchantTradeNo: string; amount: number; status: string; provider: string };
  const attempts: (PaymentData & { id: string; createdAt: Date })[] = [];
  const audit: unknown[] = [];
  let lock = Promise.resolve();

  (prisma as unknown as { $transaction: TransactionMock }).$transaction = async (run) => {
    let unlock: (() => void) | undefined;
    const tx = {
      $queryRaw: async (parts: TemplateStringsArray, id: string, customerId: string) => {
        assert.match(parts.join(' '), /"customer_id"[\s\S]*FOR UPDATE/);
        const priorLock = lock;
        lock = new Promise<void>((release) => { unlock = release; });
        await priorLock;
        return id === order.id && customerId === order.customerId ? [{ id }] : [];
      },
      refillOrder: {
        findUnique: async () => {
          assert.ok(unlock);
          return order;
        },
      },
      paymentOrder: {
        findMany: async ({ where }: { where: { refillOrderId: string; purpose: string } }) => {
          assert.deepEqual(where, { refillOrderId: order.id, purpose: 'extra_topup' });
          return attempts.slice(0, 2);
        },
        create: async ({ data }: { data: PaymentData }) => {
          const row = { ...data, id: `payment-${attempts.length + 1}`, createdAt: new Date(2026, 0, 1) };
          attempts.push(row);
          return row;
        },
      },
      refillAuditLog: { create: async ({ data }: { data: unknown }) => audit.push(data) },
    };
    try {
      return await run(tx);
    } finally {
      unlock?.();
    }
  };

  return { order, attempts, audit };
}

describe('refill payment retry', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) oldEnv.set(key, process.env[key]);
    process.env.APP_ENV = 'production';
    process.env.EXTERNAL_EFFECTS_MODE = 'enabled';
    process.env.ECPAY_MERCHANT_ID = 'synthetic-merchant';
    process.env.ECPAY_HASH_KEY = 'synthetic-hash-key';
    process.env.ECPAY_HASH_IV = 'synthetic-hash-iv';
    process.env.ECPAY_PAYMENT_URL = 'https://payment.example.test/checkout';
    process.env.ECPAY_RETURN_URL = 'https://app.example.test/return';
    process.env.ECPAY_ORDER_RESULT_URL = 'https://app.example.test/callback';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test';
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = oldEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    (prisma as unknown as { $transaction: typeof originalTransaction }).$transaction =
      originalTransaction;
  });

  it('preserves existing checkout retry behavior for base payments', async () => {
    let status = 'draft';
    let sequence = 0;
    const tradeNos: string[] = [];

    (prisma as unknown as { $transaction: TransactionMock }).$transaction = async (
      fn: (tx: unknown) => Promise<unknown>,
    ) => {
      const tx = {
        paymentOrder: {
          create: async ({ data }: { data: { merchantTradeNo: string } }) => {
            tradeNos.push(data.merchantTradeNo);
            sequence += 1;
            return {
              id: `payment-${sequence}`,
              ...data,
              amount: 129,
            };
          },
        },
        refillOrder: {
          findUnique: async () => ({
            id: 'refill-1',
            customerId: 'customer-1',
            merchantId: 'merchant-1',
            orderType: 'first',
            deliveryMode: 'first',
            baseAmount: 129,
            extraAmount: 0,
            totalAmount: 129,
            status,
            oldContainerSerial: null,
            merchant: { name: '測試店家' },
          }),
          update: async () => {
            status = 'payment_pending';
            return {};
          },
        },
        jarCode: { findFirst: async () => null },
        refillAuditLog: { create: async () => ({}) },
      };
      return fn(tx);
    };

    const first = await initiateRefillPayment({
      orderId: 'refill-1',
      customerId: 'customer-1',
    });
    const retry = await initiateRefillPayment({
      orderId: 'refill-1',
      customerId: 'customer-1',
    });

    assert.equal(tradeNos.length, 2);
    assert.notEqual(first.paymentOrderId, retry.paymentOrderId);
    assert.notEqual(first.merchantTradeNo, retry.merchantTradeNo);
    assert.equal(first.amount, 129);
    assert.equal(retry.amount, 129);
  });

  it('returns the same NT$30 checkout for concurrent retries on the same order', async () => {
    const { order, attempts, audit } = mockTopup();
    const [first, retry] = await Promise.all([
      initiateRefillPayment(topup),
      initiateRefillPayment(topup),
    ]);

    assert.deepEqual(first, retry);
    assert.equal(first.amount, 30);
    assert.equal(first.checkout.fields.TotalAmount, '30');
    assert.equal(first.checkout.fields.CustomField1, topup.orderId);
    assert.equal(first.checkout.fields.MerchantTradeDate, '2026/01/01 00:00:00');
    assert.equal(attempts.length, 1);
    assert.equal(audit.length, 1);
    assert.equal(order.totalAmount, 99);
    assert.equal(order.status, 'awaiting_extra_payment');
  });

  it('blocks charging another account or charging on a stale amount or state', async () => {
    const { order, attempts } = mockTopup();
    await assert.rejects(
      initiateRefillPayment({ ...topup, customerId: 'other-customer' }),
      { code: 'ORDER_NOT_FOUND' },
    );
    order.totalAmount = 129;
    await assert.rejects(initiateRefillPayment(topup), { code: 'INVALID_STATUS' });
    order.totalAmount = 99;
    order.status = 'paid_waiting_return';
    await assert.rejects(initiateRefillPayment(topup), { code: 'INVALID_STATUS' });
    assert.equal(attempts.length, 0);
  });

  it('does not generate another charge when historical attempts need reconciliation', async () => {
    const { attempts, audit } = mockTopup();
    await initiateRefillPayment(topup);
    attempts[0].status = 'failed';
    await assert.rejects(initiateRefillPayment(topup), { code: 'TOPUP_PAYMENT_REVIEW_REQUIRED' });
    assert.equal(attempts.length, 1);
    attempts[0].status = 'pending';
    attempts.push({ ...attempts[0], id: 'other-payment', merchantTradeNo: 'XT-legacy' });
    await assert.rejects(initiateRefillPayment(topup), { code: 'TOPUP_PAYMENT_REVIEW_REQUIRED' });
    assert.equal(attempts.length, 2);
    assert.equal(audit.length, 1);
  });
});
