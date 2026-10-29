/**
 * 店家換罐會員名單的租戶隔離 contract — 不連資料庫。
 *
 * 這裡不是斷言 UI 文字，而是攔截 `@/lib/prisma`，用一個會「真的解讀」
 * where／select／orderBy／take 的 in-memory 評估器執行 `listMerchantJarExchangeMembers`
 * 實際送出的查詢。只要有人把 signupStore／storeId／storeName 之類的可見性來源
 * 加回去，或把跨店點數讀回 DTO，下面的案例就會失敗。
 *
 * stub 對任何寫入方法與未宣告的 model（例如 store、memberPointsLedger）一律拋錯，
 * 因此這條路徑是唯讀，且不可能再回頭做 store key 解析或讀點數帳。
 */
import assert from 'node:assert/strict';
import Module, { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { before, describe, it } from 'node:test';

type Row = Record<string, unknown>;
type PrismaCall = { model: string; method: string; args?: unknown };

const FORBIDDEN_WRITE_METHODS = [
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
] as const;

// ---------------------------------------------------------------------------
// 最小的 Prisma where／select 評估器
// ---------------------------------------------------------------------------

function matchScalar(value: unknown, condition: unknown): boolean {
  if (condition === null || typeof condition !== 'object') {
    return value === condition;
  }
  const c = condition as Record<string, unknown>;
  if ('in' in c) {
    const list = c.in;
    if (!Array.isArray(list)) throw new Error('`in` expects an array');
    return list.includes(value);
  }
  if ('equals' in c) {
    if (
      c.mode === 'insensitive' &&
      typeof value === 'string' &&
      typeof c.equals === 'string'
    ) {
      return value.toLowerCase() === c.equals.toLowerCase();
    }
    return value === c.equals;
  }
  if ('not' in c) return !matchScalar(value, c.not);
  throw new Error(`unsupported scalar condition: ${JSON.stringify(condition)}`);
}

function matchRow(row: Row, where: unknown): boolean {
  if (where == null) return true;
  if (typeof where !== 'object') throw new Error('where must be an object');

  for (const [key, condition] of Object.entries(where as Record<string, unknown>)) {
    if (key === 'AND') {
      const list = Array.isArray(condition) ? condition : [condition];
      if (!list.every((c) => matchRow(row, c))) return false;
      continue;
    }
    if (key === 'OR') {
      if (!Array.isArray(condition)) throw new Error('OR expects an array');
      if (!condition.some((c) => matchRow(row, c))) return false;
      continue;
    }
    if (key === 'NOT') {
      if (matchRow(row, condition)) return false;
      continue;
    }

    const value = row[key];
    if (Array.isArray(value)) {
      const c = (condition ?? {}) as Record<string, unknown>;
      if ('some' in c) {
        if (!(value as Row[]).some((r) => matchRow(r, c.some))) return false;
        continue;
      }
      if ('none' in c) {
        if ((value as Row[]).some((r) => matchRow(r, c.none))) return false;
        continue;
      }
      if ('every' in c) {
        if (!(value as Row[]).every((r) => matchRow(r, c.every))) return false;
        continue;
      }
      throw new Error(`unsupported relation filter on ${key}`);
    }

    if (!(key in row)) {
      throw new Error(`query filtered on unknown field: ${key}`);
    }
    if (!matchScalar(value, condition)) return false;
  }
  return true;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a) < String(b) ? -1 : 1;
}

function sortRows(rows: Row[], orderBy: unknown): Row[] {
  const entries = Object.entries(orderBy as Record<string, 'asc' | 'desc'>);
  if (entries.length !== 1) throw new Error('only single-field orderBy is supported');
  const [field, direction] = entries[0];
  const sign = direction === 'desc' ? -1 : 1;
  return [...rows].sort((x, y) => sign * compareValues(x[field], y[field]));
}

function project(row: Row, select: unknown): Row {
  if (!select || typeof select !== 'object') throw new Error('select is required');
  const out: Row = {};
  for (const [key, spec] of Object.entries(select as Record<string, unknown>)) {
    if (!(key in row)) throw new Error(`query selected unknown field: ${key}`);
    const value = row[key];
    if (spec === true) {
      out[key] = value ?? null;
      continue;
    }
    if (!spec || typeof spec !== 'object') {
      throw new Error(`unsupported select for ${key}`);
    }
    if (!Array.isArray(value)) {
      throw new Error(`select ${key} expects a relation list`);
    }
    const nested = spec as {
      where?: unknown;
      orderBy?: unknown;
      select?: unknown;
      take?: number;
    };
    let rows = (value as Row[]).filter((r) => matchRow(r, nested.where));
    if (nested.orderBy) rows = sortRows(rows, nested.orderBy);
    if (typeof nested.take === 'number') rows = rows.slice(0, nested.take);
    out[key] = rows.map((r) => project(r, nested.select));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MAIN_MERCHANT_ID = 'merchant_main';
const OTHER_MERCHANT_ID = 'merchant_other';
const MAIN_MERCHANT_CODE = 'MER-001';
const MAIN_MERCHANT_NAME = '匠寵中和店';

const MERCHANTS: Row[] = [
  { id: MAIN_MERCHANT_ID, merchantId: MAIN_MERCHANT_CODE, name: MAIN_MERCHANT_NAME },
  { id: OTHER_MERCHANT_ID, merchantId: 'MER-002', name: '匠寵板橋店' },
];

function jarService(serviceStatus: string): Row[] {
  return [{ serviceType: 'jar_exchange', serviceStatus }];
}

function order(merchantId: string, status: string, completedAt: Date | null): Row {
  return { merchantId, status, completedAt };
}

/**
 * 01／02 刻意填入「舊版實作會命中」的開戶欄位（MER 編號、Store id、店名），
 * 所以一旦可見性來源被加回去，這兩位就會出現在名單裡。
 */
const CUSTOMERS: Row[] = [
  {
    id: 'cus_signup_only',
    customerId: 'furmosa-0001',
    name: '01 只有在本店開戶',
    petName: '小白',
    signupStore: MAIN_MERCHANT_CODE,
    storeId: null,
    storeName: null,
    services: jarService('active'),
    refillOrders: [],
  },
  {
    id: 'cus_store_fields_only',
    customerId: 'furmosa-0002',
    name: '02 只有店家欄位',
    petName: null,
    signupStore: null,
    storeId: 'store_main',
    storeName: MAIN_MERCHANT_NAME,
    services: jarService('active'),
    refillOrders: [],
  },
  {
    id: 'cus_pending_only',
    customerId: 'furmosa-0003',
    name: '03 只有未完成訂單',
    petName: null,
    signupStore: null,
    storeId: null,
    storeName: null,
    services: jarService('active'),
    refillOrders: [
      order(MAIN_MERCHANT_ID, 'payment_pending', null),
      order(MAIN_MERCHANT_ID, 'paid_waiting_return', null),
      order(MAIN_MERCHANT_ID, 'old_container_verified', null),
    ],
  },
  {
    id: 'cus_other_store_completed',
    customerId: 'furmosa-0004',
    name: '04 只在他店完成',
    petName: null,
    signupStore: null,
    storeId: null,
    storeName: null,
    services: jarService('active'),
    refillOrders: [order(OTHER_MERCHANT_ID, 'completed', new Date('2026-04-04T02:00:00Z'))],
  },
  {
    id: 'cus_current_store_completed',
    customerId: 'furmosa-0005',
    name: '05 在本店完成一次',
    petName: '阿柴',
    signupStore: null,
    storeId: null,
    storeName: null,
    services: jarService('active'),
    refillOrders: [order(MAIN_MERCHANT_ID, 'completed', new Date('2026-03-01T01:00:00Z'))],
  },
  {
    id: 'cus_multiple_completed',
    customerId: 'furmosa-0006',
    name: '06 在本店完成多次',
    petName: null,
    signupStore: null,
    storeId: null,
    storeName: null,
    services: jarService('active'),
    refillOrders: [
      order(MAIN_MERCHANT_ID, 'completed', new Date('2026-01-05T01:00:00Z')),
      order(MAIN_MERCHANT_ID, 'completed', new Date('2026-05-20T01:00:00Z')),
      order(MAIN_MERCHANT_ID, 'completed', new Date('2026-02-10T01:00:00Z')),
      // 他店較新的完成紀錄不得影響本店的最後換罐時間。
      order(OTHER_MERCHANT_ID, 'completed', new Date('2026-09-09T01:00:00Z')),
      order(MAIN_MERCHANT_ID, 'payment_pending', null),
    ],
  },
  {
    id: 'cus_paused_completed',
    customerId: 'furmosa-0007',
    name: '07 服務暫停但在本店完成',
    petName: null,
    signupStore: null,
    storeId: null,
    storeName: null,
    services: jarService('paused'),
    refillOrders: [order(MAIN_MERCHANT_ID, 'completed', new Date('2026-06-06T01:00:00Z'))],
  },
  {
    id: 'cus_closed_service',
    customerId: 'furmosa-0008',
    name: '08 服務已關閉',
    petName: null,
    signupStore: null,
    storeId: null,
    storeName: null,
    services: jarService('closed'),
    refillOrders: [order(MAIN_MERCHANT_ID, 'completed', new Date('2026-07-07T01:00:00Z'))],
  },
];

// ---------------------------------------------------------------------------
// Prisma stub
// ---------------------------------------------------------------------------

const calls: PrismaCall[] = [];

function record(model: string, method: string, args?: unknown): void {
  calls.push({ model, method, args });
}

function withForbiddenWrites(model: string, delegate: Row): Row {
  const guarded: Row = { ...delegate };
  for (const method of FORBIDDEN_WRITE_METHODS) {
    guarded[method] = async () => {
      record(model, method);
      throw new Error(`${model}.${method} must not be called`);
    };
  }
  return guarded;
}

const merchantDelegate = withForbiddenWrites('merchant', {
  findUnique: async (args: { where?: Row; select?: unknown }) => {
    record('merchant', 'findUnique', args);
    const id = args?.where?.id;
    const found = MERCHANTS.find((m) => m.id === id);
    return found ? project(found, args.select) : null;
  },
  findFirst: async (args: unknown) => {
    record('merchant', 'findFirst', args);
    throw new Error('merchant.findFirst must not be called');
  },
});
const customerDelegate = withForbiddenWrites('customer', {
  findMany: async (args: {
    where?: unknown;
    select?: unknown;
    orderBy?: unknown;
    take?: number;
  }) => {
    record('customer', 'findMany', args);
    let rows = CUSTOMERS.filter((row) => matchRow(row, args?.where));
    if (args?.orderBy) rows = sortRows(rows, args.orderBy);
    if (typeof args?.take === 'number') rows = rows.slice(0, args.take);
    return rows.map((row) => project(row, args?.select));
  },
  findUnique: async (args: unknown) => {
    record('customer', 'findUnique', args);
    throw new Error('customer.findUnique must not be called');
  },
  findFirst: async (args: unknown) => {
    record('customer', 'findFirst', args);
    throw new Error('customer.findFirst must not be called');
  },
});

const prismaStub = new Proxy(
  {
    merchant: merchantDelegate,
    customer: customerDelegate,
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
  __TEST_PRISMA__: typeof prismaStub;
};
harness.__TEST_PRISMA__ = prismaStub;

const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/prisma') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export const prisma = globalThis.__TEST_PRISMA__;',
    };
  }
  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(loader)}`, pathToFileURL(import.meta.url));

// tsx 會把測試轉成 CJS，所以 ESM loader hook 之外還要攔 `require('@/lib/prisma')`。
type NodeModuleLoad = (request: string, parent: unknown, isMain: boolean) => unknown;
const moduleApi = Module as unknown as { _load: NodeModuleLoad };
const originalLoad = moduleApi._load;

function isPrismaRequest(request: string): boolean {
  return (
    request === '@/lib/prisma' ||
    request.endsWith('/lib/prisma') ||
    request.endsWith('/lib/prisma.ts') ||
    request.includes('/lib/prisma.')
  );
}

let listMerchantJarExchangeMembers: (typeof import('@/lib/refill/merchant'))['listMerchantJarExchangeMembers'];

// ---------------------------------------------------------------------------
// Expected query construction
// ---------------------------------------------------------------------------

const EXPECTED_MERCHANT_FIND_UNIQUE_ARGS = {
  where: { id: MAIN_MERCHANT_ID },
  select: { id: true },
};

const EXPECTED_CUSTOMER_FIND_MANY_ARGS = {
  where: {
    services: {
      some: {
        serviceType: 'jar_exchange',
        serviceStatus: { in: ['active', 'paused'] },
      },
    },
    refillOrders: {
      some: { merchantId: MAIN_MERCHANT_ID, status: 'completed' },
    },
  },
  select: {
    id: true,
    customerId: true,
    name: true,
    petName: true,
    services: {
      where: { serviceType: 'jar_exchange' },
      select: { serviceStatus: true },
      take: 1,
    },
    refillOrders: {
      where: { merchantId: MAIN_MERCHANT_ID, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
      take: 1,
    },
  },
  orderBy: { name: 'asc' },
  take: 200,
};

const DTO_FIELDS = [
  'customerId',
  'id',
  'lastExchangeAt',
  'name',
  'petName',
  'serviceStatus',
];

function reset(): void {
  calls.length = 0;
}

function customerFindManyArgs(): unknown {
  const call = calls.find((c) => c.model === 'customer' && c.method === 'findMany');
  assert.ok(call, 'expected a customer.findMany call');
  return call.args;
}

describe('listMerchantJarExchangeMembers 租戶隔離', () => {
  before(async () => {
    moduleApi._load = function patchedLoad(request, parent, isMain) {
      if (isPrismaRequest(String(request))) {
        return { prisma: harness.__TEST_PRISMA__ };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    try {
      ({ listMerchantJarExchangeMembers } = await import('@/lib/refill/merchant'));
    } finally {
      moduleApi._load = originalLoad;
    }
  });

  it('只用本店 completed 訂單構成查詢，不碰開戶欄位或點數帳', async () => {
    reset();
    await listMerchantJarExchangeMembers(MAIN_MERCHANT_ID);

    assert.deepEqual(calls.map((c) => `${c.model}.${c.method}`), [
      'merchant.findUnique',
      'customer.findMany',
    ]);
    assert.deepEqual(
      calls[0].args,
      EXPECTED_MERCHANT_FIND_UNIQUE_ARGS,
      'merchant lookup should no longer read merchantId/name for store-key resolution',
    );
    assert.deepEqual(customerFindManyArgs(), EXPECTED_CUSTOMER_FIND_MANY_ARGS);

    const serialized = JSON.stringify(customerFindManyArgs());
    for (const leak of ['signupStore', 'storeId', 'storeName', 'pointsLedger', 'balanceAfter']) {
      assert.equal(
        serialized.includes(leak),
        false,
        `query must not reference ${leak}`,
      );
    }
  });

  it('只回傳在本店完成過換罐的會員', async () => {
    reset();
    const members = await listMerchantJarExchangeMembers(MAIN_MERCHANT_ID);

    assert.deepEqual(members.map((m) => m.id), [
      'cus_current_store_completed',
      'cus_multiple_completed',
      'cus_paused_completed',
    ]);
  });

  it('排除只有在本店開戶的會員', async () => {
    reset();
    const members = await listMerchantJarExchangeMembers(MAIN_MERCHANT_ID);
    assert.equal(members.some((m) => m.id === 'cus_signup_only'), false);
  });

  it('排除只有 storeId／storeName 的會員', async () => {
    reset();
    const members = await listMerchantJarExchangeMembers(MAIN_MERCHANT_ID);
    assert.equal(members.some((m) => m.id === 'cus_store_fields_only'), false);
  });

  it('排除只有未完成訂單的會員', async () => {
    reset();
    const members = await listMerchantJarExchangeMembers(MAIN_MERCHANT_ID);
    assert.equal(members.some((m) => m.id === 'cus_pending_only'), false);
  });

  it('排除只在他店完成的會員', async () => {
    reset();
    const members = await listMerchantJarExchangeMembers(MAIN_MERCHANT_ID);
    assert.equal(members.some((m) => m.id === 'cus_other_store_completed'), false);
  });

  it('納入在本店完成的會員並帶出本店最後換罐時間', async () => {
    reset();
    const members = await listMerchantJarExchangeMembers(MAIN_MERCHANT_ID);
    const member = members.find((m) => m.id === 'cus_current_store_completed');

    assert.ok(member);
    assert.equal(member.customerId, 'furmosa-0005');
    assert.equal(member.name, '05 在本店完成一次');
    assert.equal(member.petName, '阿柴');
    assert.equal(member.serviceStatus, 'active');
    assert.equal(member.lastExchangeAt, new Date('2026-03-01T01:00:00Z').toISOString());
  });

  it('同一位會員多筆本店完成訂單只出現一次，且不採用他店較新的紀錄', async () => {
    reset();
    const members = await listMerchantJarExchangeMembers(MAIN_MERCHANT_ID);
    const matched = members.filter((m) => m.id === 'cus_multiple_completed');

    assert.equal(matched.length, 1);
    assert.equal(
      matched[0].lastExchangeAt,
      new Date('2026-05-20T01:00:00Z').toISOString(),
    );
  });

  it('回傳的 DTO 沒有 points 或任何點數帳明細', async () => {
    reset();
    const members = await listMerchantJarExchangeMembers(MAIN_MERCHANT_ID);

    assert.ok(members.length > 0);
    for (const member of members) {
      assert.deepEqual(Object.keys(member).sort(), DTO_FIELDS);
      assert.equal('points' in member, false);
      assert.equal('pointsLedger' in member, false);
      assert.equal('balanceAfter' in member, false);
    }
    assert.equal(
      calls.some((c) => c.model === 'memberPointsLedger'),
      false,
    );
  });

  it('查無店家時失敗關閉，完全不查顧客', async () => {
    reset();
    const members = await listMerchantJarExchangeMembers('merchant_does_not_exist');

    assert.deepEqual(members, []);
    assert.deepEqual(calls.map((c) => `${c.model}.${c.method}`), ['merchant.findUnique']);
  });

  it('沒有店家識別時失敗關閉，連店家都不查', async () => {
    for (const missing of ['', null, undefined]) {
      reset();
      const members = await listMerchantJarExchangeMembers(
        missing as unknown as string,
      );
      assert.deepEqual(members, [], `expected [] for ${JSON.stringify(missing)}`);
      assert.deepEqual(calls, [], `expected no query for ${JSON.stringify(missing)}`);
    }
  });

  it('這條路徑唯讀，也不再解析 store 對照表', async () => {
    reset();
    await listMerchantJarExchangeMembers(MAIN_MERCHANT_ID);

    assert.equal(
      calls.some((c) => (FORBIDDEN_WRITE_METHODS as readonly string[]).includes(c.method)),
      false,
    );
    assert.equal(calls.some((c) => c.model === 'store'), false);
    assert.equal(calls.some((c) => c.method === '<access>'), false);
  });
});

