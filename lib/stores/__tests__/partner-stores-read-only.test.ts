import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';
import { getGroomingCouponDiscountForStore } from '../../coupons/store-discount.ts';
import { isCustomerFacingPartnerStore } from '../partner-store-visibility.ts';

type PrismaCall = { model: string; method: string };

const FORBIDDEN_STORE_METHODS = [
  'create',
  'update',
  'upsert',
  'delete',
  'createMany',
  'updateMany',
  'deleteMany',
] as const;

const calls: PrismaCall[] = [];
let findManyImpl: (args: unknown) => Promise<unknown[]> = async () => [];

function record(model: string, method: string): void {
  calls.push({ model, method });
}

function forbiddenDelegate(model: string): Record<string, () => Promise<never>> {
  const methods = ['findMany', 'findUnique', 'findFirst', ...FORBIDDEN_STORE_METHODS];
  const delegate: Record<string, () => Promise<never>> = {};
  for (const method of methods) {
    delegate[method] = async () => {
      record(model, method);
      throw new Error(`${model}.${method} must not be called`);
    };
  }
  return delegate;
}

const storeDelegate = {
  findMany: async (args: unknown) => {
    record('store', 'findMany');
    return findManyImpl(args);
  },
  ...Object.fromEntries(
    FORBIDDEN_STORE_METHODS.map((method) => [
      method,
      async () => {
        record('store', method);
        throw new Error(`store.${method} must not be called`);
      },
    ]),
  ),
};

const prisma = new Proxy(
  {
    store: storeDelegate,
    merchant: forbiddenDelegate('merchant'),
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop as keyof typeof target];
      record(String(prop), '<access>');
      throw new Error(`prisma.${String(prop)} must not be accessed`);
    },
  },
);

const harness = globalThis as typeof globalThis & {
  __TEST_PRISMA__: typeof prisma;
  __TEST_DISCOUNT__: typeof getGroomingCouponDiscountForStore;
  __TEST_VISIBLE__: typeof isCustomerFacingPartnerStore;
  __TEST_SYNC_CALLS__: number;
};

harness.__TEST_PRISMA__ = prisma;
harness.__TEST_DISCOUNT__ = getGroomingCouponDiscountForStore;
harness.__TEST_VISIBLE__ = isCustomerFacingPartnerStore;
harness.__TEST_SYNC_CALLS__ = 0;

const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/prisma') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export const prisma = globalThis.__TEST_PRISMA__;',
    };
  }
  if (specifier === '@/lib/coupons/store-discount') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export const getGroomingCouponDiscountForStore = globalThis.__TEST_DISCOUNT__;',
    };
  }
  if (specifier === '@/lib/stores/partner-store-visibility') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export const isCustomerFacingPartnerStore = globalThis.__TEST_VISIBLE__;',
    };
  }
  if (specifier === '@/lib/stores/sync-merchant-stores') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export async function syncAllJarExchangePartnerStores(){globalThis.__TEST_SYNC_CALLS__+=1;throw new Error("syncAllJarExchangePartnerStores must not be called")}',
    };
  }
  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(loader)}`, pathToFileURL(import.meta.url));

const { listPartnerStoresFromDb, FALLBACK_PARTNER_STORES } = await import(
  '../partner-stores.ts'
);

const EXPECTED_FIND_MANY_ARGS = {
  orderBy: { name: 'asc' },
  select: { id: true, slug: true, name: true },
};

const DB_ROWS = [
  { id: 'store_mer_other', slug: 'mer_other', name: '錯誤店家對照（勿交付）' },
  { id: 'store_niuniu', slug: 'niuniu', name: '淡水妞妞' },
  { id: 'store_zhuwo', slug: 'zhuwo_zhonghe', name: '豬窩 中和店' },
];

function expectedView(row: { id: string; slug: string; name: string }) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    groomingDiscountAmount: getGroomingCouponDiscountForStore(row.slug, row.name),
  };
}

function expectedFallback(includeInternal?: boolean) {
  const views = FALLBACK_PARTNER_STORES.map((s) => ({
    id: `fallback_${s.slug}`,
    slug: s.slug,
    name: s.name,
    groomingDiscountAmount: getGroomingCouponDiscountForStore(s.slug, s.name),
  }));
  return includeInternal === true
    ? views
    : views.filter((s) => isCustomerFacingPartnerStore(s));
}

function resetHarness(impl: (args: unknown) => Promise<unknown[]>) {
  calls.length = 0;
  harness.__TEST_SYNC_CALLS__ = 0;
  findManyImpl = impl;
}

function assertReadOnlyFindMany(args: unknown) {
  assert.deepEqual(args, EXPECTED_FIND_MANY_ARGS);
  assert.deepEqual(calls, [{ model: 'store', method: 'findMany' }]);
  assert.equal(harness.__TEST_SYNC_CALLS__, 0);
  assert.equal(
    calls.some((c) => c.model === 'merchant'),
    false,
  );
  assert.equal(
    calls.some((c) => c.model === 'store' && c.method !== 'findMany'),
    false,
  );
}

describe('listPartnerStoresFromDb is read-only', () => {
  it('returns sorted customer-facing views when DB has rows', async () => {
    let received: unknown;
    resetHarness(async (args) => {
      received = args;
      return DB_ROWS;
    });

    const rows = await listPartnerStoresFromDb();
    assertReadOnlyFindMany(received);
    assert.deepEqual(rows, [expectedView(DB_ROWS[1]), expectedView(DB_ROWS[2])]);
  });

  it('keeps internal stores only when includeInternal is true', async () => {
    let received: unknown;
    resetHarness(async (args) => {
      received = args;
      return DB_ROWS;
    });

    const rows = await listPartnerStoresFromDb({ includeInternal: true });
    assertReadOnlyFindMany(received);
    assert.deepEqual(rows, DB_ROWS.map(expectedView));
  });

  it('uses fallback when findMany returns no rows', async () => {
    let received: unknown;
    resetHarness(async (args) => {
      received = args;
      return [];
    });

    const rows = await listPartnerStoresFromDb();
    assertReadOnlyFindMany(received);
    assert.deepEqual(rows, expectedFallback());
  });

  it('uses the same fallback includeInternal contract when DB is empty', async () => {
    resetHarness(async () => []);

    const hidden = await listPartnerStoresFromDb();
    const shown = await listPartnerStoresFromDb({ includeInternal: true });
    assert.deepEqual(hidden, expectedFallback());
    assert.deepEqual(shown, expectedFallback(true));
    assert.equal(harness.__TEST_SYNC_CALLS__, 0);
    assert.deepEqual(calls, [
      { model: 'store', method: 'findMany' },
      { model: 'store', method: 'findMany' },
    ]);
  });

  it('uses fallback when findMany fails and still does not mutate', async () => {
    let received: unknown;
    resetHarness(async (args) => {
      received = args;
      throw new Error('synthetic-findMany-failure');
    });

    const rows = await listPartnerStoresFromDb();
    assertReadOnlyFindMany(received);
    assert.deepEqual(rows, expectedFallback());
  });
});
