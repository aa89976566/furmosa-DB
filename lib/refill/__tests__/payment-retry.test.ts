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

  it('creates a fresh MerchantTradeNo for every explicit checkout retry', async () => {
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
});
