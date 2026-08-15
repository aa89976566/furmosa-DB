import assert from 'node:assert/strict';
import Module, { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { before, describe, it } from 'node:test';
import { isInternalMerchantId } from '../partner-store-visibility.ts';
import type { MerchantType } from '../../merchant-types.ts';

type PrismaCall = { model: string; method: string };
type StoreCreateData = {
  id: string;
  name: string;
  slug: string;
  secretToken: string;
};
type StoreUpdateCall = {
  where: { id: string };
  data: Record<string, unknown>;
};
type MerchantRow = {
  id: string;
  merchantId: string;
  name: string;
  status: string;
  type: string;
  types: MerchantType[];
};
type StoreRow = {
  id: string;
  name: string;
  slug: string;
};

const PLACEHOLDER_RE = /^[A-Za-z0-9_-]{32}$/;
const EXISTING_SENTINEL = 'existing-row-token-must-stay';

const ACTIVE_JAR: MerchantRow = {
  id: 'merchant_mer_0001',
  merchantId: 'MER-0001',
  name: '淡水妞妞',
  status: 'active',
  type: 'consignment',
  types: ['consignment', 'jar_exchange'],
};
const ACTIVE_JAR_B: MerchantRow = {
  id: 'merchant_mer_0014',
  merchantId: 'MER-0014',
  name: '柒沐寵物美容',
  status: 'active',
  type: 'consignment',
  types: ['consignment', 'jar_exchange'],
};
const INACTIVE_JAR: MerchantRow = {
  id: 'merchant_mer_0002',
  merchantId: 'MER-0002',
  name: '停用換罐店',
  status: 'inactive',
  type: 'consignment',
  types: ['consignment', 'jar_exchange'],
};
const ACTIVE_CONSIGNMENT_ONLY: MerchantRow = {
  id: 'merchant_mer_0003',
  merchantId: 'MER-0003',
  name: '只寄賣店',
  status: 'active',
  type: 'consignment',
  types: ['consignment'],
};
const INTERNAL_JAR: MerchantRow = {
  id: 'merchant_mer_other',
  merchantId: 'MER-OTHER',
  name: '錯誤店家對照（勿交付）',
  status: 'active',
  type: 'consignment',
  types: ['consignment', 'jar_exchange'],
};

const calls: PrismaCall[] = [];
const storeCreates: StoreCreateData[] = [];
const storeUpdates: StoreUpdateCall[] = [];
const typesMapCalls: { id: string; type: string }[][] = [];
let merchants: MerchantRow[] = [];
let stores: StoreRow[] = [];

const harness = globalThis as typeof globalThis & {
  __SYNC_PRISMA_TOUCHED__: boolean;
  __TEST_IS_INTERNAL__: typeof isInternalMerchantId;
  __TEST_GET_MERCHANT_TYPES_MAP__: (
    db: unknown,
    rows: { id: string; type: string }[],
  ) => Promise<Map<string, MerchantType[]>>;
};

harness.__SYNC_PRISMA_TOUCHED__ = false;
harness.__TEST_IS_INTERNAL__ = isInternalMerchantId;
harness.__TEST_GET_MERCHANT_TYPES_MAP__ = async (_db, rows) => {
  typesMapCalls.push(rows);
  return new Map(
    rows.map((row) => {
      const match = merchants.find((merchant) => merchant.id === row.id);
      return [row.id, match?.types ?? ['consignment']];
    }),
  );
};

// register() hooks are process-wide. This file must run as its own node:test
// process so the prisma / types-map mocks cannot leak into other test files.
const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/prisma') {
    return mockResolved('@/lib/prisma');
  }
  if (specifier === '@/lib/merchant-types-persist') {
    return mockResolved('@/lib/merchant-types-persist');
  }
  if (specifier === '@/lib/stores/partner-store-visibility') {
    return mockResolved('@/lib/stores/partner-store-visibility');
  }
  const resolved = await nextResolve(specifier, context);
  const url = String(resolved.url || '');
  if (url.includes('/lib/prisma.') || url.endsWith('/lib/prisma')) {
    return mockResolved('@/lib/prisma');
  }
  if (url.includes('/lib/merchant-types-persist.')) {
    return mockResolved('@/lib/merchant-types-persist');
  }
  if (url.includes('/lib/stores/partner-store-visibility.')) {
    return mockResolved('@/lib/stores/partner-store-visibility');
  }
  return resolved;
}

function mockResolved(specifier) {
  if (specifier === '@/lib/prisma') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export const prisma=new Proxy({},{get(){globalThis.__SYNC_PRISMA_TOUCHED__=true;throw new Error("default prisma must not be used")}})',
    };
  }
  if (specifier === '@/lib/merchant-types-persist') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export async function getMerchantTypesMap(db,merchants){return globalThis.__TEST_GET_MERCHANT_TYPES_MAP__(db,merchants)}',
    };
  }
  return {
    shortCircuit: true,
    url: 'data:text/javascript,export const isInternalMerchantId=globalThis.__TEST_IS_INTERNAL__;',
  };
}
`;

register(`data:text/javascript,${encodeURIComponent(loader)}`, pathToFileURL(import.meta.url));

type NodeModuleLoad = (request: string, parent: unknown, isMain: boolean) => unknown;
const moduleApi = Module as unknown as { _load: NodeModuleLoad };
const originalLoad = moduleApi._load;

let merchantToStoreSlug: (merchantId: string) => string;
let syncPartnerStoreForJarExchangeMerchant: (
  db: never,
  merchant: {
    id: string;
    merchantId: string;
    name: string;
    status: string;
  },
  types: MerchantType[],
) => Promise<void>;
let syncAllJarExchangePartnerStores: (db: never) => Promise<number>;

before(async () => {
  try {
    moduleApi._load = function patchedLoad(request, parent, isMain) {
      const req = String(request);
      if (
        req === '@/lib/prisma' ||
        req.endsWith('/lib/prisma') ||
        req.endsWith('/lib/prisma.ts')
      ) {
        return {
          prisma: new Proxy(
            {},
            {
              get() {
                harness.__SYNC_PRISMA_TOUCHED__ = true;
                throw new Error('default prisma must not be used');
              },
            },
          ),
        };
      }
      if (req.includes('merchant-types-persist')) {
        return {
          getMerchantTypesMap: harness.__TEST_GET_MERCHANT_TYPES_MAP__,
        };
      }
      if (req.includes('partner-store-visibility')) {
        return { isInternalMerchantId: harness.__TEST_IS_INTERNAL__ };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    ({
      merchantToStoreSlug,
      syncPartnerStoreForJarExchangeMerchant,
      syncAllJarExchangePartnerStores,
    } = await import('../sync-merchant-stores.ts'));
  } finally {
    moduleApi._load = originalLoad;
  }
  assert.equal(moduleApi._load, originalLoad);
});

function record(model: string, method: string): void {
  calls.push({ model, method });
}

function forbidden(model: string, method: string) {
  return async () => {
    record(model, method);
    throw new Error(`${model}.${method} must not be called`);
  };
}

const db = {
  merchant: {
    findMany: async (args: {
      where?: { status?: string };
      select?: unknown;
      orderBy?: unknown;
    }) => {
      record('merchant', 'findMany');
      assert.deepEqual(args?.where, { status: 'active' });
      assert.deepEqual(args?.select, {
        id: true,
        merchantId: true,
        name: true,
        status: true,
        type: true,
      });
      assert.deepEqual(args?.orderBy, { merchantId: 'asc' });
      return merchants
        .filter((row) => row.status === 'active')
        .slice()
        .sort((a, b) => a.merchantId.localeCompare(b.merchantId))
        .map((row) => ({
          id: row.id,
          merchantId: row.merchantId,
          name: row.name,
          status: row.status,
          type: row.type,
        }));
    },
    findFirst: forbidden('merchant', 'findFirst'),
    findUnique: forbidden('merchant', 'findUnique'),
    create: forbidden('merchant', 'create'),
    update: forbidden('merchant', 'update'),
  },
  store: {
    findUnique: async (args: { where?: { slug?: string }; select?: unknown }) => {
      record('store', 'findUnique');
      assert.deepEqual(args?.select, { id: true, name: true });
      const slug = args?.where?.slug;
      const row = stores.find((store) => store.slug === slug);
      return row ? { id: row.id, name: row.name } : null;
    },
    findFirst: async (args: {
      where?: { name?: { equals?: string; mode?: string } };
      select?: unknown;
    }) => {
      record('store', 'findFirst');
      assert.deepEqual(args?.select, { id: true, name: true });
      assert.equal(args?.where?.name?.mode, 'insensitive');
      const expected = args?.where?.name?.equals?.toLowerCase();
      const row = stores.find((store) => store.name.toLowerCase() === expected);
      return row ? { id: row.id, name: row.name } : null;
    },
    create: async (args: { data: StoreCreateData }) => {
      record('store', 'create');
      storeCreates.push(args.data);
      return args.data;
    },
    update: async (args: StoreUpdateCall) => {
      record('store', 'update');
      storeUpdates.push(args);
      return { id: args.where.id, ...args.data };
    },
    findMany: forbidden('store', 'findMany'),
    upsert: forbidden('store', 'upsert'),
    delete: forbidden('store', 'delete'),
  },
  $queryRaw: forbidden('$queryRaw', 'query'),
};

function resetCase(nextMerchants: MerchantRow[], nextStores: StoreRow[]): void {
  calls.length = 0;
  storeCreates.length = 0;
  storeUpdates.length = 0;
  typesMapCalls.length = 0;
  harness.__SYNC_PRISMA_TOUCHED__ = false;
  merchants = nextMerchants;
  stores = nextStores;
}

function assertNoDefaultPrismaOrEnv(): void {
  assert.equal(harness.__SYNC_PRISMA_TOUCHED__, false);
}

function assertPlaceholder(value: string): void {
  assert.equal(typeof value, 'string');
  assert.match(value, PLACEHOLDER_RE);
}

function storeTouched(): boolean {
  return calls.some((call) => call.model === 'store');
}

function expectedCreate(merchant: MerchantRow): Omit<StoreCreateData, 'secretToken'> {
  const slug = merchantToStoreSlug(merchant.merchantId);
  return {
    id: `store_${slug}`,
    name: merchant.name,
    slug,
  };
}

describe('syncPartnerStoreForJarExchangeMerchant missing create', () => {
  it('creates exactly one missing Store with id/name/slug and a CSPRNG placeholder', async () => {
    resetCase([ACTIVE_JAR], []);

    const result = await syncPartnerStoreForJarExchangeMerchant(
      db as never,
      ACTIVE_JAR,
      ACTIVE_JAR.types,
    );

    assert.equal(storeCreates.length, 1);
    assert.equal(storeUpdates.length, 0);
    assert.deepEqual(
      {
        id: storeCreates[0].id,
        name: storeCreates[0].name,
        slug: storeCreates[0].slug,
      },
      expectedCreate(ACTIVE_JAR),
    );
    assertPlaceholder(storeCreates[0].secretToken);
    assert.equal(result, undefined);
    assert.equal(JSON.stringify(result ?? null).includes(storeCreates[0].secretToken), false);
    assertNoDefaultPrismaOrEnv();
  });

  it('two independent missing creates get different placeholders', async () => {
    resetCase([ACTIVE_JAR], []);
    await syncPartnerStoreForJarExchangeMerchant(db as never, ACTIVE_JAR, ACTIVE_JAR.types);
    const first = storeCreates[0].secretToken;

    resetCase([ACTIVE_JAR_B], []);
    await syncPartnerStoreForJarExchangeMerchant(db as never, ACTIVE_JAR_B, ACTIVE_JAR_B.types);
    const second = storeCreates[0].secretToken;

    assertPlaceholder(first);
    assertPlaceholder(second);
    assert.notEqual(first, second);
    assertNoDefaultPrismaOrEnv();
  });

  it('succeeds when Math.random throws and restores the original identity', async () => {
    resetCase([ACTIVE_JAR], []);
    const originalRandom = Math.random;
    try {
      Math.random = () => {
        throw new Error('Math.random must not be used');
      };
      await syncPartnerStoreForJarExchangeMerchant(db as never, ACTIVE_JAR, ACTIVE_JAR.types);
    } finally {
      Math.random = originalRandom;
    }

    assert.equal(Math.random, originalRandom);
    assert.equal(storeCreates.length, 1);
    assertPlaceholder(storeCreates[0].secretToken);
    assert.equal(storeUpdates.length, 0);
    assertNoDefaultPrismaOrEnv();
  });
});

describe('syncPartnerStoreForJarExchangeMerchant existing slug/name matrix', () => {
  it('existing slug + same name: 0 create / 0 update', async () => {
    const slug = merchantToStoreSlug(ACTIVE_JAR.merchantId);
    resetCase(
      [ACTIVE_JAR],
      [{ id: `store_${slug}`, name: ACTIVE_JAR.name, slug }],
    );

    const result = await syncPartnerStoreForJarExchangeMerchant(
      db as never,
      ACTIVE_JAR,
      ACTIVE_JAR.types,
    );

    assert.equal(storeCreates.length, 0);
    assert.equal(storeUpdates.length, 0);
    assert.equal(
      calls.some((call) => call.model === 'store' && call.method === 'create'),
      false,
    );
    assert.equal(
      calls.some((call) => call.model === 'store' && call.method === 'update'),
      false,
    );
    assert.equal(result, undefined);
    assert.equal(JSON.stringify(result ?? null).includes(EXISTING_SENTINEL), false);
    assertNoDefaultPrismaOrEnv();
  });

  it('existing slug + different name: only update {name}', async () => {
    const slug = merchantToStoreSlug(ACTIVE_JAR.merchantId);
    resetCase(
      [ACTIVE_JAR],
      [{ id: `store_${slug}`, name: `${ACTIVE_JAR.name}（舊名）`, slug }],
    );

    const result = await syncPartnerStoreForJarExchangeMerchant(
      db as never,
      ACTIVE_JAR,
      ACTIVE_JAR.types,
    );

    assert.equal(storeCreates.length, 0);
    assert.equal(storeUpdates.length, 1);
    assert.deepEqual(storeUpdates[0], {
      where: { id: `store_${slug}` },
      data: { name: ACTIVE_JAR.name },
    });
    assert.equal('secretToken' in storeUpdates[0].data, false);
    assert.equal(result, undefined);
    assert.equal(JSON.stringify(result ?? null).includes(EXISTING_SENTINEL), false);
    assertNoDefaultPrismaOrEnv();
  });

  it('existing name (no slug match): does not create', async () => {
    resetCase(
      [ACTIVE_JAR],
      [{ id: 'store_legacy_name', name: ACTIVE_JAR.name, slug: 'legacy_name' }],
    );

    const result = await syncPartnerStoreForJarExchangeMerchant(
      db as never,
      ACTIVE_JAR,
      ACTIVE_JAR.types,
    );

    assert.equal(storeCreates.length, 0);
    assert.equal(storeUpdates.length, 0);
    assert.equal(result, undefined);
    assertNoDefaultPrismaOrEnv();
  });

  it('existing name with different casing: only update {name}', async () => {
    const merchant = {
      ...ACTIVE_JAR,
      name: 'Niuniu Pet',
    };
    resetCase(
      [merchant],
      [{ id: 'store_legacy_name', name: 'niuniu pet', slug: 'legacy_name' }],
    );

    const result = await syncPartnerStoreForJarExchangeMerchant(
      db as never,
      merchant,
      merchant.types,
    );

    assert.equal(storeCreates.length, 0);
    assert.equal(storeUpdates.length, 1);
    assert.deepEqual(storeUpdates[0], {
      where: { id: 'store_legacy_name' },
      data: { name: 'Niuniu Pet' },
    });
    assert.equal('secretToken' in storeUpdates[0].data, false);
    assert.equal(result, undefined);
    assertNoDefaultPrismaOrEnv();
  });
});

describe('syncPartnerStoreForJarExchangeMerchant skips inactive / non-jar_exchange', () => {
  it('inactive merchant does not touch Store', async () => {
    resetCase([INACTIVE_JAR], []);

    const result = await syncPartnerStoreForJarExchangeMerchant(
      db as never,
      INACTIVE_JAR,
      INACTIVE_JAR.types,
    );

    assert.equal(storeTouched(), false);
    assert.equal(storeCreates.length, 0);
    assert.equal(storeUpdates.length, 0);
    assert.equal(result, undefined);
    assertNoDefaultPrismaOrEnv();
  });

  it('non-jar_exchange merchant does not touch Store', async () => {
    resetCase([ACTIVE_CONSIGNMENT_ONLY], []);

    const result = await syncPartnerStoreForJarExchangeMerchant(
      db as never,
      ACTIVE_CONSIGNMENT_ONLY,
      ACTIVE_CONSIGNMENT_ONLY.types,
    );

    assert.equal(storeTouched(), false);
    assert.equal(storeCreates.length, 0);
    assert.equal(storeUpdates.length, 0);
    assert.equal(result, undefined);
    assertNoDefaultPrismaOrEnv();
  });
});

describe('syncAllJarExchangePartnerStores filter / count / call', () => {
  it('syncs only active non-internal jar_exchange merchants and keeps the count', async () => {
    resetCase(
      [ACTIVE_JAR, ACTIVE_JAR_B, INACTIVE_JAR, ACTIVE_CONSIGNMENT_ONLY, INTERNAL_JAR],
      [
        {
          id: `store_${merchantToStoreSlug(ACTIVE_JAR_B.merchantId)}`,
          name: `${ACTIVE_JAR_B.name}（舊名）`,
          slug: merchantToStoreSlug(ACTIVE_JAR_B.merchantId),
        },
      ],
    );

    const synced = await syncAllJarExchangePartnerStores(db as never);

    assert.equal(synced, 2);
    assert.equal(typesMapCalls.length, 1);
    assert.deepEqual(
      typesMapCalls[0].map((row) => row.id),
      [ACTIVE_JAR, ACTIVE_CONSIGNMENT_ONLY, ACTIVE_JAR_B, INTERNAL_JAR].map((row) => row.id),
    );

    assert.equal(storeCreates.length, 1);
    assert.deepEqual(
      {
        id: storeCreates[0].id,
        name: storeCreates[0].name,
        slug: storeCreates[0].slug,
      },
      expectedCreate(ACTIVE_JAR),
    );
    assertPlaceholder(storeCreates[0].secretToken);

    assert.equal(storeUpdates.length, 1);
    assert.deepEqual(storeUpdates[0], {
      where: { id: `store_${merchantToStoreSlug(ACTIVE_JAR_B.merchantId)}` },
      data: { name: ACTIVE_JAR_B.name },
    });
    assert.equal('secretToken' in storeUpdates[0].data, false);

    assert.equal(
      calls.some((call) => call.model === 'store' && call.method === 'delete'),
      false,
    );
    assert.equal(JSON.stringify(synced).includes(storeCreates[0].secretToken), false);
    assertNoDefaultPrismaOrEnv();
  });
});
