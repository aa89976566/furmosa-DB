import assert from 'node:assert/strict';
import Module, { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { before, describe, it } from 'node:test';
import { ZHUWO_CONSIGNMENT_BRANCHES } from '../zhuwo-branches.ts';

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
  city: string;
  type: string;
  status: string;
  types: string[];
};
type StoreRow = {
  id: string;
  name: string;
  slug: string;
};

const PLACEHOLDER_LENGTH = 32;
const PLACEHOLDER_CHARSET = /^[A-Za-z0-9_-]+$/;
const EXISTING_SENTINEL = 'existing-row-token-must-stay';

const calls: PrismaCall[] = [];
const storeCreates: StoreCreateData[] = [];
const storeUpdates: StoreUpdateCall[] = [];
let merchants: MerchantRow[] = [];
let stores: StoreRow[] = [];

const harness = globalThis as typeof globalThis & {
  __ZHUWO_PRISMA_TOUCHED__: boolean;
  __ZHUWO_SYNC_CALLS__: number;
};

harness.__ZHUWO_PRISMA_TOUCHED__ = false;
harness.__ZHUWO_SYNC_CALLS__ = 0;

const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (
    specifier === '@/lib/prisma' ||
    specifier === '@/lib/stores/sync-merchant-stores'
  ) {
    return mockResolved(specifier);
  }
  const resolved = await nextResolve(specifier, context);
  const url = String(resolved.url || '');
  if (url.includes('/lib/prisma.') || url.endsWith('/lib/prisma')) {
    return mockResolved('@/lib/prisma');
  }
  if (url.includes('/lib/stores/sync-merchant-stores.')) {
    return mockResolved('@/lib/stores/sync-merchant-stores');
  }
  return resolved;
}

function mockResolved(specifier) {
  if (specifier === '@/lib/prisma') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export const prisma=new Proxy({},{get(){globalThis.__ZHUWO_PRISMA_TOUCHED__=true;throw new Error("default prisma must not be used")}})',
    };
  }
  return {
    shortCircuit: true,
    url: 'data:text/javascript,export async function syncPartnerStoreForJarExchangeMerchant(){globalThis.__ZHUWO_SYNC_CALLS__+=1}',
  };
}
`;

register(`data:text/javascript,${encodeURIComponent(loader)}`, pathToFileURL(import.meta.url));

type NodeModuleLoad = (request: string, parent: unknown, isMain: boolean) => unknown;
const moduleApi = Module as unknown as { _load: NodeModuleLoad };
const originalLoad = moduleApi._load;

let ensureZhuwoConsignmentBranches: (
  db: never,
) => Promise<{ name: string; merchantId: string; created: boolean }[]>;

before(async () => {
  try {
    moduleApi._load = function patchedLoad(request, parent, isMain) {
      const req = String(request);
      if (req.includes('sync-merchant-stores')) {
        return {
          syncPartnerStoreForJarExchangeMerchant: async () => {
            harness.__ZHUWO_SYNC_CALLS__ += 1;
          },
        };
      }
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
                harness.__ZHUWO_PRISMA_TOUCHED__ = true;
                throw new Error('default prisma must not be used');
              },
            },
          ),
        };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    ({ ensureZhuwoConsignmentBranches } = await import('../ensure-zhuwo-merchants.ts'));
  } finally {
    moduleApi._load = originalLoad;
  }
  assert.equal(moduleApi._load, originalLoad);
});

function record(model: string, method: string): void {
  calls.push({ model, method });
}

function matchingMerchant(where: unknown): MerchantRow | null {
  const hay = JSON.stringify(where ?? {});
  return (
    merchants.find(
      (row) => hay.includes(row.name) || hay.includes(row.merchantId),
    ) ?? null
  );
}

function forbidden(model: string, method: string) {
  return async () => {
    record(model, method);
    throw new Error(`${model}.${method} must not be called`);
  };
}

const db = {
  merchant: {
    findFirst: async (args: { where?: unknown }) => {
      record('merchant', 'findFirst');
      return matchingMerchant(args?.where);
    },
    findUnique: forbidden('merchant', 'findUnique'),
    findMany: forbidden('merchant', 'findMany'),
    create: forbidden('merchant', 'create'),
    update: forbidden('merchant', 'update'),
  },
  store: {
    findUnique: async (args: { where?: { slug?: string } }) => {
      record('store', 'findUnique');
      const slug = args?.where?.slug;
      return stores.find((row) => row.slug === slug) ?? null;
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
    findFirst: forbidden('store', 'findFirst'),
    findMany: forbidden('store', 'findMany'),
    upsert: forbidden('store', 'upsert'),
    delete: forbidden('store', 'delete'),
  },
};

function resetCase(nextStores: StoreRow[]): void {
  calls.length = 0;
  storeCreates.length = 0;
  storeUpdates.length = 0;
  harness.__ZHUWO_PRISMA_TOUCHED__ = false;
  harness.__ZHUWO_SYNC_CALLS__ = 0;
  merchants = ZHUWO_CONSIGNMENT_BRANCHES.map((branch) => ({
    id: `merchant_${branch.merchantId}`,
    merchantId: branch.merchantId,
    name: branch.name,
    city: branch.city,
    type: 'consignment',
    status: 'active',
    types: ['consignment', 'jar_exchange'],
  }));
  stores = nextStores;
}

function assertNoDefaultPrismaOrEnv(): void {
  assert.equal(harness.__ZHUWO_PRISMA_TOUCHED__, false);
  assert.equal(harness.__ZHUWO_SYNC_CALLS__, ZHUWO_CONSIGNMENT_BRANCHES.length);
}

function assertPlaceholder(value: string): void {
  assert.equal(typeof value, 'string');
  assert.equal(value.length, PLACEHOLDER_LENGTH);
  assert.equal(value.length > 0, true);
  assert.match(value, PLACEHOLDER_CHARSET);
  assert.equal(value.includes('+'), false);
  assert.equal(value.includes('/'), false);
  assert.equal(value.includes('='), false);
}

function assertResultHasNoPlaceholder(
  result: { name: string; merchantId: string; created: boolean }[],
  placeholders: string[],
): void {
  const serialized = JSON.stringify(result);
  for (const row of result) {
    assert.deepEqual(Object.keys(row).sort(), ['created', 'merchantId', 'name']);
    assert.equal('secretToken' in row, false);
  }
  for (const placeholder of placeholders) {
    assert.equal(serialized.includes(placeholder), false);
  }
}

describe('zhuwo runtime config has no storeSecretToken', () => {
  it('keeps merchantId/name/city/storeSlug and drops storeSecretToken', () => {
    assert.equal(ZHUWO_CONSIGNMENT_BRANCHES.length, 3);
    for (const branch of ZHUWO_CONSIGNMENT_BRANCHES) {
      assert.equal('storeSecretToken' in branch, false);
      assert.deepEqual(Object.keys(branch).sort(), [
        'city',
        'merchantId',
        'name',
        'storeSlug',
      ]);
    }
  });
});

describe('ensureZhuwoConsignmentBranches store create/update matrix', () => {
  it('creates three missing zhuwo_* rows with unique URL-safe placeholders', async () => {
    resetCase([]);

    const result = await ensureZhuwoConsignmentBranches(db as never);

    assert.equal(storeCreates.length, 3);
    assert.equal(storeUpdates.length, 0);
    assert.deepEqual(
      storeCreates.map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
      ZHUWO_CONSIGNMENT_BRANCHES.map((branch) => ({
        id: `store_${branch.storeSlug}`,
        name: branch.name,
        slug: branch.storeSlug,
      })),
    );

    const placeholders = storeCreates.map((row) => row.secretToken);
    for (const placeholder of placeholders) {
      assertPlaceholder(placeholder);
    }
    assert.equal(new Set(placeholders).size, placeholders.length);

    assert.deepEqual(
      result,
      ZHUWO_CONSIGNMENT_BRANCHES.map((branch) => ({
        name: branch.name,
        merchantId: branch.merchantId,
        created: false,
      })),
    );
    assertResultHasNoPlaceholder(result, placeholders);
    assertNoDefaultPrismaOrEnv();
  });

  it('does not create or update when existing row has the same name', async () => {
    resetCase(
      ZHUWO_CONSIGNMENT_BRANCHES.map((branch) => ({
        id: `store_${branch.storeSlug}`,
        name: branch.name,
        slug: branch.storeSlug,
      })),
    );

    const result = await ensureZhuwoConsignmentBranches(db as never);

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
    assertResultHasNoPlaceholder(result, [EXISTING_SENTINEL]);
    assertNoDefaultPrismaOrEnv();
  });

  it('updates only name when existing row has a different name', async () => {
    resetCase(
      ZHUWO_CONSIGNMENT_BRANCHES.map((branch) => ({
        id: `store_${branch.storeSlug}`,
        name: `${branch.name}（舊名）`,
        slug: branch.storeSlug,
      })),
    );

    const result = await ensureZhuwoConsignmentBranches(db as never);

    assert.equal(storeCreates.length, 0);
    assert.equal(storeUpdates.length, 3);
    for (const [index, branch] of ZHUWO_CONSIGNMENT_BRANCHES.entries()) {
      assert.deepEqual(storeUpdates[index], {
        where: { id: `store_${branch.storeSlug}` },
        data: { name: branch.name },
      });
      assert.equal('secretToken' in storeUpdates[index].data, false);
    }
    assertResultHasNoPlaceholder(result, [EXISTING_SENTINEL]);
    assertNoDefaultPrismaOrEnv();
  });

  it('mixed rows: create missing, skip same name, rename only', async () => {
    const [zhonghe, banqiao, tucheng] = ZHUWO_CONSIGNMENT_BRANCHES;
    resetCase([
      {
        id: `store_${banqiao.storeSlug}`,
        name: banqiao.name,
        slug: banqiao.storeSlug,
      },
      {
        id: `store_${tucheng.storeSlug}`,
        name: `${tucheng.name}（舊名）`,
        slug: tucheng.storeSlug,
      },
    ]);

    const result = await ensureZhuwoConsignmentBranches(db as never);

    assert.equal(storeCreates.length, 1);
    assert.equal(storeCreates[0].slug, zhonghe.storeSlug);
    assert.equal(storeCreates[0].name, zhonghe.name);
    assert.equal(storeCreates[0].id, `store_${zhonghe.storeSlug}`);
    assertPlaceholder(storeCreates[0].secretToken);

    assert.equal(storeUpdates.length, 1);
    assert.deepEqual(storeUpdates[0], {
      where: { id: `store_${tucheng.storeSlug}` },
      data: { name: tucheng.name },
    });
    assert.equal('secretToken' in storeUpdates[0].data, false);

    assertResultHasNoPlaceholder(result, [storeCreates[0].secretToken, EXISTING_SENTINEL]);
    assertNoDefaultPrismaOrEnv();
  });
});
