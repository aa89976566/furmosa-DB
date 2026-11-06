import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateCheckMacValue, verifyCheckMacValue } from '@/lib/payments/ecpay/check-mac';
import { canTransition } from '@/lib/refill/transitions';
import { REFILL_PRICES, amountsAfterExtraTopup } from '@/lib/refill/constants';
import { handleEcpayCallback, parseEcpayFormBody } from '@/lib/refill/callback';
import { prisma } from '@/lib/prisma';

describe('ecpay callback guards (unit)', () => {
  const hashKey = 'testHashKey1234567890';
  const hashIV = 'testHashIV1234567';

  it('7. amount mismatch fails mac or amount check', () => {
    const base = {
      MerchantID: '2000132',
      MerchantTradeNo: 'RFTESTAMT01',
      RtnCode: '1',
      TradeAmt: String(REFILL_PRICES.exchange),
    };
    const mac = generateCheckMacValue(base, hashKey, hashIV);
    assert.equal(
      verifyCheckMacValue({ ...base, CheckMacValue: mac }, hashKey, hashIV),
      true,
    );
    // Tampered amount with old MAC
    assert.equal(
      verifyCheckMacValue(
        { ...base, TradeAmt: '1', CheckMacValue: mac },
        hashKey,
        hashIV,
      ),
      false,
    );
    // Expected server-side: tradeAmt must equal payment.amount (99)
    assert.notEqual(1, REFILL_PRICES.exchange);
  });

  it('18. extra topup amounts fixed at 30 → total 129', () => {
    const a = amountsAfterExtraTopup(99);
    assert.equal(a.extraAmount, 30);
    assert.equal(a.totalAmount, 129);
    assert.equal(canTransition('awaiting_extra_payment', 'paid_waiting_return'), true);
  });

  it('parses form body', () => {
    const p = parseEcpayFormBody('MerchantTradeNo=ABC&RtnCode=1&TradeAmt=99');
    assert.equal(p.MerchantTradeNo, 'ABC');
    assert.equal(p.TradeAmt, '99');
  });
});

describe('ecpay callback duplicate payment guard', () => {
  const originalFindUnique = prisma.paymentOrder.findUnique;
  const originalTransaction = prisma.$transaction;
  const originalAutomationUpdateMany = prisma.automationJob.updateMany;
  const oldEnv = {
    merchantId: process.env.ECPAY_MERCHANT_ID,
    hashKey: process.env.ECPAY_HASH_KEY,
    hashIV: process.env.ECPAY_HASH_IV,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  };

  afterEach(() => {
    (prisma.paymentOrder as unknown as { findUnique: typeof originalFindUnique }).findUnique =
      originalFindUnique;
    (prisma as unknown as { $transaction: typeof originalTransaction }).$transaction =
      originalTransaction;
    (
      prisma.automationJob as unknown as {
        updateMany: typeof originalAutomationUpdateMany;
      }
    ).updateMany = originalAutomationUpdateMany;
    if (oldEnv.merchantId === undefined) delete process.env.ECPAY_MERCHANT_ID;
    else process.env.ECPAY_MERCHANT_ID = oldEnv.merchantId;
    if (oldEnv.hashKey === undefined) delete process.env.ECPAY_HASH_KEY;
    else process.env.ECPAY_HASH_KEY = oldEnv.hashKey;
    if (oldEnv.hashIV === undefined) delete process.env.ECPAY_HASH_IV;
    else process.env.ECPAY_HASH_IV = oldEnv.hashIV;
    if (oldEnv.appUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = oldEnv.appUrl;
  });

  it('records a later successful charge as requiring refund without advancing the order', async () => {
    const hashKey = 'duplicate-test-hash-key';
    const hashIV = 'duplicate-test-iv';
    process.env.ECPAY_MERCHANT_ID = 'duplicate-test-merchant';
    process.env.ECPAY_HASH_KEY = hashKey;
    process.env.ECPAY_HASH_IV = hashIV;
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test';

    const statusUpdates: string[] = [];
    const auditActions: string[] = [];
    let orderAdvanced = false;

    (prisma.paymentOrder as unknown as { findUnique: (...args: unknown[]) => Promise<unknown> })
      .findUnique = async () => ({
        id: 'payment-loser',
        refillOrderId: 'refill-1',
        purpose: 'refill',
        amount: 129,
        status: 'pending',
        refillOrder: {
          id: 'refill-1',
          merchantId: 'merchant-1',
          status: 'payment_pending',
          baseAmount: 129,
          customer: { id: 'customer-1', lineUserId: null, name: '測試會員' },
          merchant: { name: '測試店家' },
          appointment: null,
        },
      });

    (prisma as unknown as {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
    }).$transaction = async (fn) =>
      fn({
        paymentOrder: {
          findFirst: async () => ({ id: 'payment-winner' }),
          updateMany: async ({ data }: { data: { status: string } }) => {
            statusUpdates.push(data.status);
            return { count: 1 };
          },
        },
        refillOrder: {
          update: async () => {
            orderAdvanced = true;
            return {};
          },
        },
        refillAuditLog: {
          create: async ({ data }: { data: { action: string } }) => {
            auditActions.push(data.action);
            return {};
          },
        },
      });

    const callback = {
      MerchantTradeNo: 'RF-DUPLICATE-1',
      TradeNo: 'ECPAY-DUPLICATE-1',
      RtnCode: '1',
      TradeAmt: '129',
    };
    const result = await handleEcpayCallback({
      ...callback,
      CheckMacValue: generateCheckMacValue(callback, hashKey, hashIV),
    });

    assert.deepEqual(result, {
      ack: '1|OK',
      updated: true,
      reason: 'duplicate_payment_requires_refund',
    });
    assert.deepEqual(statusUpdates, ['duplicate_paid']);
    assert.equal(orderAdvanced, false);
    assert.deepEqual(auditActions, ['ecpay_duplicate_payment_requires_refund']);
  });

  it('persists the paid notification in the same transaction as the payment', async () => {
    const hashKey = 'paid-test-hash-key';
    const hashIV = 'paid-test-hash-iv';
    process.env.ECPAY_MERCHANT_ID = 'paid-test-merchant';
    process.env.ECPAY_HASH_KEY = hashKey;
    process.env.ECPAY_HASH_IV = hashIV;
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test';

    const transactionSteps: string[] = [];
    const notificationJobs: Array<Record<string, unknown>> = [];

    (prisma.paymentOrder as unknown as { findUnique: (...args: unknown[]) => Promise<unknown> })
      .findUnique = async () => ({
        id: 'payment-paid',
        refillOrderId: 'refill-paid',
        purpose: 'refill',
        amount: 129,
        status: 'pending',
        refillOrder: {
          id: 'refill-paid',
          merchantId: 'merchant-paid',
          status: 'payment_pending',
          baseAmount: 129,
          customer: { id: 'customer-paid', lineUserId: 'line-paid', name: '測試會員' },
          merchant: { name: '測試店家' },
          appointment: null,
        },
      });

    (prisma as unknown as {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
    }).$transaction = async (fn) =>
      fn({
        paymentOrder: {
          findFirst: async () => null,
          updateMany: async () => {
            transactionSteps.push('payment');
            return { count: 1 };
          },
        },
        refillOrder: {
          update: async () => {
            transactionSteps.push('refill');
            return {};
          },
        },
        refillAuditLog: {
          create: async () => {
            transactionSteps.push('audit');
            return {};
          },
        },
        automationJob: {
          upsert: async ({ create }: { create: Record<string, unknown> }) => {
            transactionSteps.push('notification');
            notificationJobs.push(create);
            return { id: 'job-paid', status: 'pending' };
          },
        },
      });

    // The durable job already exists. Skip the best-effort immediate delivery so
    // this test can focus on the transaction boundary without a LINE request.
    (
      prisma.automationJob as unknown as {
        updateMany: (...args: unknown[]) => Promise<{ count: number }>;
      }
    ).updateMany = async () => ({ count: 0 });

    const callback = {
      MerchantTradeNo: 'RF-PAID-1',
      TradeNo: 'ECPAY-PAID-1',
      RtnCode: '1',
      TradeAmt: '129',
    };
    const result = await handleEcpayCallback({
      ...callback,
      CheckMacValue: generateCheckMacValue(callback, hashKey, hashIV),
    });

    assert.deepEqual(result, { ack: '1|OK', updated: true });
    assert.deepEqual(transactionSteps, ['payment', 'refill', 'audit', 'notification']);
    assert.equal(notificationJobs.length, 1);
    assert.deepEqual(notificationJobs[0], {
      jobKey: 'line:refill-paid:refill-paid',
      type: 'line.refill_paid',
      entityType: 'refill_order',
      entityId: 'refill-paid',
      payload: { refillOrderId: 'refill-paid' },
    });
  });
});
