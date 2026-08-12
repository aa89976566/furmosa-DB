/**
 * ECPay checkout choke — mock env only，零 DB／零真網路。
 * afterEach 完整還原本檔碰過的 env 鍵與 console。
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { buildEcpayAioCheckout } from '@/lib/payments/ecpay/create';

const SYNTHETIC_MERCHANT_ID = 'synthetic-merchant-DO-NOT-LEAK';
const SYNTHETIC_HASH_KEY = 'synthetic-hash-key-DO-NOT-LEAK';
const SYNTHETIC_HASH_IV = 'synthetic-hash-iv-DO-NOT-LEAK';
const SYNTHETIC_APP_URL = 'https://synthetic-app.example';
const SYNTHETIC_TRADE_NO = 'RFSYNTHETIC0001';
const SYNTHETIC_ITEM = 'synthetic-item-DO-NOT-LEAK';

const TOUCHED_ENV_KEYS = [
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

const originalEnv: Partial<Record<(typeof TOUCHED_ENV_KEYS)[number], string | undefined>> =
  {};

let consoleChunks: string[] = [];
let fetchCalls = 0;
const originalFetch = globalThis.fetch;
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function captureConsole(...args: unknown[]) {
  consoleChunks.push(args.map((a) => String(a)).join(' '));
}

function setEnv(key: (typeof TOUCHED_ENV_KEYS)[number], value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function installSyntheticEcpayCreds() {
  setEnv('ECPAY_MERCHANT_ID', SYNTHETIC_MERCHANT_ID);
  setEnv('ECPAY_HASH_KEY', SYNTHETIC_HASH_KEY);
  setEnv('ECPAY_HASH_IV', SYNTHETIC_HASH_IV);
  setEnv('NEXT_PUBLIC_APP_URL', SYNTHETIC_APP_URL);
  setEnv(
    'ECPAY_PAYMENT_URL',
    'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  );
}

function applyDenyCase(
  caseName: 'preview' | 'local' | 'test' | 'missing_app_env' | 'missing_mode' | 'disabled',
) {
  if (caseName === 'missing_app_env') {
    setEnv('APP_ENV', undefined);
    setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
  } else if (caseName === 'missing_mode') {
    setEnv('APP_ENV', 'production');
    setEnv('EXTERNAL_EFFECTS_MODE', undefined);
  } else if (caseName === 'disabled') {
    setEnv('APP_ENV', 'production');
    setEnv('EXTERNAL_EFFECTS_MODE', 'disabled');
  } else {
    setEnv('APP_ENV', caseName);
    setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
  }
}

function assertNoSecretLeak(parts: string[]) {
  const blob = parts.join('\n');
  for (const probe of [
    SYNTHETIC_MERCHANT_ID,
    SYNTHETIC_HASH_KEY,
    SYNTHETIC_HASH_IV,
  ]) {
    assert.equal(blob.includes(probe), false, `must not leak ${probe.slice(0, 12)}…`);
  }
}

const DENY_CASES = [
  'preview',
  'local',
  'test',
  'missing_app_env',
  'missing_mode',
  'disabled',
] as const;

beforeEach(() => {
  for (const key of TOUCHED_ENV_KEYS) {
    if (!(key in originalEnv)) originalEnv[key] = process.env[key];
  }
  consoleChunks = [];
  fetchCalls = 0;
  console.log = captureConsole;
  console.info = captureConsole;
  console.warn = captureConsole;
  console.error = captureConsole;
  globalThis.fetch = ((..._args: Parameters<typeof fetch>) => {
    fetchCalls += 1;
    throw new Error('fetch must not be called in ecpay checkout choke tests');
  }) as typeof fetch;
  installSyntheticEcpayCreds();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of TOUCHED_ENV_KEYS) {
    const prev = originalEnv[key];
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  consoleChunks = [];
  fetchCalls = 0;
});

describe('ECPay checkout choke (buildEcpayAioCheckout)', () => {
  it('production+enabled allows synthetic checkout form', () => {
    setEnv('APP_ENV', 'production');
    setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');

    const checkout = buildEcpayAioCheckout({
      merchantTradeNo: SYNTHETIC_TRADE_NO,
      amount: 99,
      itemName: SYNTHETIC_ITEM,
    });

    assert.ok(checkout.paymentUrl);
    assert.equal(typeof checkout.fields.CheckMacValue, 'string');
    assert.ok(checkout.fields.CheckMacValue.length > 0);
    assert.equal(checkout.fields.MerchantTradeNo, SYNTHETIC_TRADE_NO);
    assert.equal(fetchCalls, 0);
    assertNoSecretLeak(consoleChunks);
  });

  for (const caseName of DENY_CASES) {
    it(`deny ${caseName}: no form fields and throws safely`, () => {
      applyDenyCase(caseName);

      let thrown: unknown;
      try {
        buildEcpayAioCheckout({
          merchantTradeNo: SYNTHETIC_TRADE_NO,
          amount: 99,
          itemName: SYNTHETIC_ITEM,
        });
      } catch (e) {
        thrown = e;
      }

      assert.ok(thrown instanceof Error);
      assert.equal((thrown as Error).message, '外部副作用已停用');
      assert.equal(fetchCalls, 0);
      assertNoSecretLeak([(thrown as Error).message, ...consoleChunks]);
    });
  }
});

describe('ECPay checkout choke (initiateRefillPayment before DB)', () => {
  it('deny paths throw EXTERNAL_EFFECTS_DISABLED before any prisma call', async () => {
    const prismaMod = await import('@/lib/prisma');
    const paymentMod = await import('@/lib/refill/payment');

    let prismaTouched = 0;
    const client = prismaMod.prisma as unknown as Record<string, unknown>;
    const refillOrder = client.refillOrder as {
      findUnique: (...args: unknown[]) => Promise<unknown>;
    };
    const paymentOrder = client.paymentOrder as {
      findFirst: (...args: unknown[]) => Promise<unknown>;
    };
    const originalFindUnique = refillOrder.findUnique.bind(refillOrder);
    const originalFindFirst = paymentOrder.findFirst.bind(paymentOrder);
    const originalTransaction = (
      prismaMod.prisma as { $transaction: (...args: unknown[]) => Promise<unknown> }
    ).$transaction.bind(prismaMod.prisma);

    refillOrder.findUnique = async (...args: unknown[]) => {
      prismaTouched += 1;
      return originalFindUnique(...args);
    };
    paymentOrder.findFirst = async (...args: unknown[]) => {
      prismaTouched += 1;
      return originalFindFirst(...args);
    };
    (prismaMod.prisma as { $transaction: (...args: unknown[]) => Promise<unknown> }).$transaction =
      async (...args: unknown[]) => {
        prismaTouched += 1;
        return originalTransaction(...args);
      };

    try {
      for (const caseName of DENY_CASES) {
        applyDenyCase(caseName);
        prismaTouched = 0;
        await assert.rejects(
          () =>
            paymentMod.initiateRefillPayment({
              orderId: 'synthetic-order-id',
              customerId: 'synthetic-customer-id',
            }),
          (err: unknown) => {
            assert.ok(err instanceof Error);
            assert.equal(
              (err as { code?: string }).code,
              'EXTERNAL_EFFECTS_DISABLED',
            );
            assert.equal((err as Error).message, '付款功能目前無法使用，請稍後再試。');
            assertNoSecretLeak([(err as Error).message, ...consoleChunks]);
            return true;
          },
        );
        assert.equal(prismaTouched, 0, `deny ${caseName} must not touch prisma`);
        assert.equal(fetchCalls, 0);
      }
    } finally {
      refillOrder.findUnique = originalFindUnique;
      paymentOrder.findFirst = originalFindFirst;
      (
        prismaMod.prisma as { $transaction: (...args: unknown[]) => Promise<unknown> }
      ).$transaction = originalTransaction;
    }
  });
});
