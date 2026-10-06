import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import {
  loadMerchantCommercialModulesSafe,
  merchantCommercialModuleSelect,
} from '../load-commercial-modules-safe.ts';

function knownPrismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('test error', {
    code,
    clientVersion: 'test',
  });
}

test('loads only the requested merchant commercial modules with the original ordering', async () => {
  const expected = [{
    id: 'module-1',
    mode: 'consignment',
    effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
    effectiveUntil: null,
  }];
  let received: Prisma.MerchantCommercialModuleFindManyArgs | undefined;

  const result = await loadMerchantCommercialModulesSafe('merchant-1', async (args) => {
    received = args;
    return expected;
  });

  assert.deepEqual(result, { status: 'ok', modules: expected });
  assert.deepEqual(received, {
    where: { merchantId: 'merchant-1' },
    orderBy: { effectiveFrom: 'desc' },
    select: merchantCommercialModuleSelect,
  });
});

for (const code of ['P2021', 'P2022']) {
  test(`degrades only the commercial modules section for ${code}`, async () => {
    const originalConsoleError = console.error;
    console.error = () => undefined;
    try {
      const result = await loadMerchantCommercialModulesSafe('merchant-1', async () => {
        throw knownPrismaError(code);
      });
      assert.deepEqual(result, { status: 'unavailable' });
    } finally {
      console.error = originalConsoleError;
    }
  });
}

test('rethrows other known Prisma errors', async () => {
  const error = knownPrismaError('P2025');
  await assert.rejects(
    loadMerchantCommercialModulesSafe('merchant-1', async () => {
      throw error;
    }),
    (received) => received === error,
  );
});

test('rethrows ordinary errors', async () => {
  const error = new Error('network unavailable');
  await assert.rejects(
    loadMerchantCommercialModulesSafe('merchant-1', async () => {
      throw error;
    }),
    (received) => received === error,
  );
});
