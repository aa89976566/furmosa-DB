/**
 * assignNewAndComplete 的 mock 契約。
 *
 * 這裡攔截 Prisma，確認鎖順序、CAS 與通知分支。
 * 它不能證明 PostgreSQL 的 row lock、lock timeout、deadlock 或多連線競態。
 */
import assert from 'node:assert/strict';
import Module, { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { before, beforeEach, describe, it } from 'node:test';
import { RefillError, toRefillHttp } from '@/lib/refill/errors';

type Row = Record<string, unknown>;

type OrderRow = {
  id: string;
  merchantId: string;
  customerId: string;
  status: string;
  orderType: string;
  deliveryMode: string;
  paidAt: Date | null;
  oldContainerSerial: string | null;
  newContainerSerial: string | null;
  oldContainerReturnedAt: Date | null;
  pointsAwardedAt: Date | null;
  completedAt: Date | null;
};

type JarRow = {
  id: string;
  code: string;
  status: string;
  redeemedByCustomerId: string | null;
  issuedAt: Date | null;
  issuedMerchantId: string | null;
  returnedAt: Date | null;
  returnedMerchantId: string | null;
  lockedByRefillOrderId: string | null;
};

type LedgerRow = {
  id: string;
  customerId: string;
  sourceType: string;
  sourceRefId: string | null;
  pointsChange: number;
  balanceAfter: number;
  note: string | null;
  createdAt: Date;
};

type SqlFlat = {
  text: string;
  params: unknown[];
  tagged: boolean;
};

type WriteRecord = {
  model: 'jar-old' | 'jar-new' | 'order';
  where: Row;
  data: Row;
  count: number;
};

const MERCHANT = 'merchant_1';
const CUSTOMER = 'cus_1';
const ORDER = 'order_1';
const OLD_CODE = '11111111';
const NEW_CODE = '22222222';

const state: {
  orders: OrderRow[];
  jars: JarRow[];
  ledger: LedgerRow[];
  audits: Row[];
} = { orders: [], jars: [], ledger: [], audits: [] };

const seq: string[] = [];
const rawCalls: SqlFlat[] = [];
const writes: WriteRecord[] = [];
const notifications: Row[] = [];
let inTx = false;
let unsafeRaw = 0;
let forceCount: { 'jar-old': number | null; 'jar-new': number | null; order: number | null } = {
  'jar-old': null,
  'jar-new': null,
  order: null,
};

function isSql(value: unknown): value is { strings: readonly string[]; values: readonly unknown[] } {
  if (!value || typeof value !== 'object') return false;
  const row = value as { strings?: unknown; values?: unknown };
  return Array.isArray(row.strings) && Array.isArray(row.values);
}

function flattenSql(strings: readonly string[], values: readonly unknown[]): { text: string; params: unknown[] } {
  const params: unknown[] = [];
  const walk = (parts: readonly string[], vals: readonly unknown[]): string => {
    let text = '';
    for (let i = 0; i < parts.length; i += 1) {
      text += parts[i];
      if (i >= vals.length) continue;
      const value = vals[i];
      if (isSql(value)) text += walk(value.strings, value.values);
      else {
        params.push(value);
        text += `$${params.length}`;
      }
    }
    return text;
  };
  return {
    text: walk(strings, values).replace(/\s+/g, ' ').trim(),
    params,
  };
}

function matchesWhere(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') {
      return Array.isArray(condition) && condition.some((item) => matchesWhere(row, item as Row));
    }
    if (key === 'AND') {
      return Array.isArray(condition) && condition.every((item) => matchesWhere(row, item as Row));
    }
    return row[key] === condition;
  });
}

function jar(partial: Partial<JarRow> & Pick<JarRow, 'id' | 'code' | 'status'>): JarRow {
  return {
    redeemedByCustomerId: null,
    issuedAt: null,
    issuedMerchantId: null,
    returnedAt: null,
    returnedMerchantId: null,
    lockedByRefillOrderId: null,
    ...partial,
  };
}

function order(partial: Partial<OrderRow> = {}): OrderRow {
  return {
    id: ORDER,
    merchantId: MERCHANT,
    customerId: CUSTOMER,
    status: 'old_container_verified',
    orderType: 'exchange',
    deliveryMode: 'exchange',
    paidAt: new Date('2026-04-01T00:00:00.000Z'),
    oldContainerSerial: OLD_CODE,
    newContainerSerial: null,
    oldContainerReturnedAt: null,
    pointsAwardedAt: null,
    completedAt: null,
    ...partial,
  };
}

function reset(next?: { orders?: OrderRow[]; jars?: JarRow[]; ledger?: LedgerRow[] }): void {
  state.orders = next?.orders ?? [order()];
  state.jars = next?.jars ?? [
    jar({
      id: 'jar_a',
      code: OLD_CODE,
      status: 'issued',
      redeemedByCustomerId: CUSTOMER,
      lockedByRefillOrderId: ORDER,
    }),
    jar({ id: 'jar_b', code: NEW_CODE, status: 'unused' }),
  ];
  state.ledger = next?.ledger ?? [];
  state.audits = [];
  seq.length = 0;
  rawCalls.length = 0;
  writes.length = 0;
  notifications.length = 0;
  unsafeRaw = 0;
  forceCount = { 'jar-old': null, 'jar-new': null, order: null };
}

function rawKinds(): string[] {
  return rawCalls.map((call) => {
    if (call.text.includes('"refill_orders"')) return 'order';
    if (call.text.includes('"jar_codes"')) return 'jar';
    if (call.text.includes('pg_advisory_xact_lock')) return 'points';
    return `other:${call.text}`;
  });
}

function orderLockSql(): SqlFlat {
  const call = rawCalls.find((item) => item.text.includes('"refill_orders"'));
  assert.ok(call, 'expected a refill_orders lock query');
  return call;
}

function jarLockSqls(): SqlFlat[] {
  return rawCalls.filter((item) => item.text.includes('"jar_codes"'));
}

async function onQueryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> {
  const flat = flattenSql(strings, values);
  const tagged = Array.isArray(strings) && 'raw' in strings;
  rawCalls.push({ text: flat.text, params: flat.params, tagged });
  seq.push('tx.queryRaw');
  if (flat.text.includes('"refill_orders"') && flat.text.includes('FOR UPDATE')) {
    const [id, merchantId] = flat.params;
    const found = state.orders.find((row) => row.id === id && row.merchantId === merchantId);
    return found ? [{ id: found.id }] : [];
  }
  if (flat.text.includes('"jar_codes"') && flat.text.includes('FOR UPDATE')) {
    const codes = flat.params.filter((value): value is string => typeof value === 'string');
    return state.jars
      .filter((row) => codes.includes(row.code))
      .map((row) => ({ id: row.id }));
  }
  if (flat.text.includes('pg_advisory_xact_lock')) return [{ ok: 1 }];
  throw new Error(`unexpected queryRaw: ${flat.text}`);
}

function applyUpdateMany(model: 'jar-old' | 'jar-new' | 'order', args: { where: Row; data: Row }): { count: number } {
  seq.push(`tx.${model}.updateMany`);
  const forced = forceCount[model];
  const rows = model === 'order'
    ? state.orders.filter((row) => matchesWhere(row, args.where))
    : state.jars.filter((row) => matchesWhere(row, args.where));
  const count = forced ?? rows.length;
  writes.push({
    model,
    where: structuredClone(args.where),
    data: structuredClone(args.data),
    count,
  });
  if (forced != null) return { count: forced };
  for (const row of rows) Object.assign(row, args.data);
  return { count };
}

const tx = {
  $queryRaw: onQueryRaw,
  $queryRawUnsafe: async () => {
    unsafeRaw += 1;
    throw new Error('unsafe raw is forbidden');
  },
  $executeRawUnsafe: async () => {
    unsafeRaw += 1;
    throw new Error('unsafe raw is forbidden');
  },
  refillOrder: {
    findUnique: async (args: { where?: { id?: string } }) => {
      seq.push(inTx ? 'tx.refillOrder.findUnique' : 'refillOrder.findUnique');
      return state.orders.find((row) => row.id === args.where?.id) ?? null;
    },
    updateMany: async (args: { where: Row; data: Row }) => applyUpdateMany('order', args),
  },
  jarCode: {
    findUnique: async (args: { where?: { code?: string } }) => {
      seq.push('tx.jarCode.findUnique');
      return state.jars.find((row) => row.code === args.where?.code) ?? null;
    },
    updateMany: async (args: { where: Row; data: Row }) => {
      const model = 'OR' in args.where ? 'jar-new' : 'jar-old';
      return applyUpdateMany(model, args);
    },
  },
  paymentOrder: {
    findFirst: async () => {
      seq.push('tx.paymentOrder.findFirst');
      return null;
    },
  },
  memberPointsLedger: {
    findFirst: async (args: { where?: Row }) => {
      seq.push(inTx ? 'tx.memberPointsLedger.findFirst' : 'memberPointsLedger.findFirst');
      const where = args.where ?? {};
      const rows = state.ledger.filter((row) => {
        if (where.customerId != null && row.customerId !== where.customerId) return false;
        if (where.sourceType != null && row.sourceType !== where.sourceType) return false;
        if (where.sourceRefId != null && row.sourceRefId !== where.sourceRefId) return false;
        return true;
      });
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
      return rows[0] ?? null;
    },
    create: async (args: { data: Row }) => {
      seq.push('tx.memberPointsLedger.create');
      const data = args.data;
      const row: LedgerRow = {
        id: `led_${state.ledger.length + 1}`,
        customerId: String(data.customerId),
        sourceType: String(data.sourceType),
        sourceRefId: (data.sourceRefId as string | null) ?? null,
        pointsChange: Number(data.pointsChange),
        balanceAfter: Number(data.balanceAfter),
        note: (data.note as string | null) ?? null,
        createdAt: new Date(),
      };
      state.ledger.push(row);
      return row;
    },
  },
  refillAuditLog: {
    create: async (args: { data: Row }) => {
      seq.push('tx.refillAuditLog.create');
      state.audits.push(structuredClone(args.data));
      return args.data;
    },
  },
};

const prismaStub = {
  refillOrder: tx.refillOrder,
  memberPointsLedger: tx.memberPointsLedger,
  automationJob: {
    upsert: async (args: Row) => {
      seq.push('automationJob.upsert');
      notifications.push(structuredClone(args));
      return { id: 'job_1', status: 'recorded' };
    },
  },
  $transaction: async <T>(
    fn: (client: typeof tx) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T> => {
    transactionOptions = options;
    const snap = structuredClone(state);
    inTx = true;
    try {
      return await fn(tx);
    } catch (error) {
      state.orders = snap.orders;
      state.jars = snap.jars;
      state.ledger = snap.ledger;
      state.audits = snap.audits;
      throw error;
    } finally {
      inTx = false;
    }
  },
  $queryRawUnsafe: tx.$queryRawUnsafe,
  $executeRawUnsafe: tx.$executeRawUnsafe,
};

let transactionOptions: { maxWait?: number; timeout?: number } | undefined;

const harness = globalThis as typeof globalThis & {
  __ASSIGN_COMPLETE_PRISMA__: typeof prismaStub;
};
harness.__ASSIGN_COMPLETE_PRISMA__ = prismaStub;

const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/prisma') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export const prisma = globalThis.__ASSIGN_COMPLETE_PRISMA__;',
    };
  }
  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(loader)}`, pathToFileURL(import.meta.url));

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

let assignNewAndComplete: (typeof import('@/lib/refill/merchant'))['assignNewAndComplete'];

async function complete(newSerialRaw = NEW_CODE, orderId = ORDER) {
  return assignNewAndComplete({
    orderId,
    merchantId: MERCHANT,
    actorId: 'staff_1',
    newSerialRaw,
  });
}

function assertNoFollowUp(after: string): void {
  const at = seq.lastIndexOf(after);
  assert.ok(at >= 0, `missing ${after}`);
  const rest = seq.slice(at + 1);
  for (const name of [
    'tx.memberPointsLedger.create',
    'tx.refillAuditLog.create',
    'tx.order.updateMany',
    'tx.jar-new.updateMany',
    'automationJob.upsert',
  ]) {
    assert.equal(rest.includes(name), false, `${name} continued after ${after}`);
  }
  assert.equal(notifications.length, 0);
}

describe('assignNewAndComplete 完成交付併發防護（mock，非 PostgreSQL 證明）', () => {
  before(async () => {
    moduleApi._load = function patchedLoad(request, parent, isMain) {
      if (isPrismaRequest(String(request))) return { prisma: harness.__ASSIGN_COMPLETE_PRISMA__ };
      return originalLoad.call(this, request, parent, isMain);
    };
    try {
      ({ assignNewAndComplete } = await import('@/lib/refill/merchant'));
    } finally {
      moduleApi._load = originalLoad;
    }
  });

  beforeEach(() => {
    reset();
    transactionOptions = undefined;
  });

  it('換罐完成交易保留足夠時間，不使用 Prisma 預設的 5 秒逾時', async () => {
    await complete();
    assert.deepEqual(transactionOptions, { maxWait: 10_000, timeout: 30_000 });
  });

  it('第一個交易業務查詢是 tagged raw 的 refill_orders FOR UPDATE，並帶 merchant_id', async () => {
    await complete();
    const lock = orderLockSql();
    assert.equal(rawCalls[0], lock);
    assert.equal(lock.tagged, true);
    assert.match(lock.text, /FROM "refill_orders"/);
    assert.match(lock.text, /"merchant_id"/);
    assert.match(lock.text, /FOR UPDATE/);
    assert.equal(lock.text.includes(ORDER), false);
    assert.equal(lock.text.includes(MERCHANT), false);
    assert.deepEqual(lock.params, [ORDER, MERCHANT]);
    assert.equal(unsafeRaw, 0);
    const firstTx = seq.indexOf('tx.queryRaw');
    assert.ok(firstTx >= 0);
    assert.ok(seq.indexOf('tx.refillOrder.findUnique') > firstTx);
    assert.equal(seq.slice(0, firstTx).includes('tx.queryRaw'), false);
  });

  it('罐鎖在訂單鎖之後、點數 advisory 之前，而且多罐都依 id 排序', async () => {
    await complete();
    assert.deepEqual(rawKinds(), ['order', 'jar', 'points']);
    const first = jarLockSqls();
    assert.equal(first.length, 1);
    assert.match(first[0].text, /FROM "jar_codes"/);
    assert.match(first[0].text, /ORDER BY "id"\s+FOR UPDATE/);
    assert.equal(first[0].tagged, true);
    assert.deepEqual(first[0].params, [NEW_CODE, OLD_CODE]);
    const firstClause = first[0].text.match(/ORDER BY "id"\s+FOR UPDATE/)?.[0];

    reset({
      orders: [order({ oldContainerSerial: '33333333' })],
      jars: [
        jar({
          id: 'jar_b',
          code: '33333333',
          status: 'issued',
          redeemedByCustomerId: CUSTOMER,
          lockedByRefillOrderId: ORDER,
        }),
        jar({ id: 'jar_a', code: '44444444', status: 'unused' }),
      ],
    });
    await complete('44444444');
    const second = jarLockSqls();
    assert.equal(second.length, 1);
    assert.deepEqual(second[0].params, ['44444444', '33333333']);
    assert.equal(second[0].text.match(/ORDER BY "id"\s+FOR UPDATE/)?.[0], firstClause);
    assert.deepEqual(rawKinds(), ['order', 'jar', 'points']);
  });

  it('換罐完成會各寫一次舊罐、新罐與訂單，並只通知一次', async () => {
    const result = await complete();
    assert.deepEqual(result, {
      ok: true,
      status: 'completed',
      pointsAwarded: true,
      pointsBalance: 1,
    });
    const oldWrite = writes.find((item) => item.model === 'jar-old');
    const newWrite = writes.find((item) => item.model === 'jar-new');
    const orderWrite = writes.find((item) => item.model === 'order');
    assert.ok(oldWrite && newWrite && orderWrite);
    assert.equal(oldWrite.count, 1);
    assert.equal(newWrite.count, 1);
    assert.equal(orderWrite.count, 1);
    assert.equal(orderWrite.where.status, 'old_container_verified');
    assert.equal(orderWrite.where.merchantId, MERCHANT);
    assert.equal(orderWrite.data.status, 'completed');
    assert.equal(state.orders[0].status, 'completed');
    assert.equal(state.jars.find((item) => item.code === OLD_CODE)?.status, 'returned');
    assert.equal(state.jars.find((item) => item.code === NEW_CODE)?.status, 'issued');
    assert.equal(state.jars.find((item) => item.code === NEW_CODE)?.redeemedByCustomerId, CUSTOMER);
    assert.equal(state.ledger.length, 1);
    assert.equal(state.ledger[0].sourceType, 'refill_completed');
    assert.equal(state.ledger[0].sourceRefId, ORDER);
    assert.equal(state.ledger[0].pointsChange, 1);
    assert.equal(state.audits.length, 1);
    assert.equal(state.audits[0].action, 'refill_completed');
    assert.equal(notifications.length, 1);
    const created = notifications[0].create as Row;
    assert.equal(created.jobKey, `line:refill-completed:${ORDER}`);
    assert.equal((created.payload as Row).pointsAwarded, true);
    assert.equal(seq.filter((name) => name === 'automationJob.upsert').length, 1);
  });

  it('首罐完成不加換罐點數，其餘完成行為仍在', async () => {
    reset({
      orders: [order({
        status: 'paid_waiting_return',
        orderType: 'first',
        deliveryMode: 'first',
        oldContainerSerial: null,
      })],
      jars: [jar({ id: 'jar_b', code: NEW_CODE, status: 'unused' })],
    });
    const result = await complete();
    assert.equal(result.pointsAwarded, false);
    assert.equal(result.pointsBalance, 0);
    assert.equal(result.status, 'completed');
    assert.equal(state.ledger.length, 0);
    assert.equal(state.audits.length, 1);
    assert.equal(state.audits[0].action, 'refill_completed');
    assert.equal((state.audits[0].detail as Row).pointsAwarded, false);
    assert.equal(writes.some((item) => item.model === 'jar-old'), false);
    assert.equal(state.orders[0].pointsAwardedAt, null);
    assert.deepEqual(rawKinds(), ['order', 'jar']);
    assert.equal(notifications.length, 1);
    assert.equal(((notifications[0].create as Row).payload as Row).pointsAwarded, false);
  });

  it('已完成且是同一新罐時成功，並且不再寫入或通知', async () => {
    const awardedAt = new Date('2026-05-01T00:00:00.000Z');
    reset({
      orders: [order({
        status: 'completed',
        newContainerSerial: NEW_CODE,
        pointsAwardedAt: awardedAt,
        completedAt: awardedAt,
      })],
      jars: [jar({
        id: 'jar_b',
        code: NEW_CODE,
        status: 'issued',
        redeemedByCustomerId: CUSTOMER,
      })],
      ledger: [{
        id: 'led_existing',
        customerId: CUSTOMER,
        sourceType: 'refill_completed',
        sourceRefId: ORDER,
        pointsChange: 1,
        balanceAfter: 4,
        note: null,
        createdAt: awardedAt,
      }],
    });
    const result = await complete('2222-2222');
    assert.deepEqual(result, {
      ok: true,
      status: 'completed',
      pointsAwarded: true,
      pointsBalance: 4,
    });
    assert.equal(writes.length, 0);
    assert.equal(state.audits.length, 0);
    assert.equal(state.ledger.length, 1);
    assert.equal(notifications.length, 0);
    assert.deepEqual(rawKinds(), ['order']);
    assert.equal(seq.includes('tx.jar-new.updateMany'), false);
    assert.equal(seq.includes('tx.jar-old.updateMany'), false);
    assert.equal(seq.includes('tx.order.updateMany'), false);
    assert.equal(seq.includes('tx.memberPointsLedger.create'), false);
  });

  it('已完成但新罐不同時回 409，而且沒有副作用', async () => {
    reset({
      orders: [order({
        status: 'completed',
        newContainerSerial: '33333333',
        pointsAwardedAt: new Date('2026-05-01T00:00:00.000Z'),
      })],
    });
    await assert.rejects(complete(), (error: unknown) => {
      assert.ok(error instanceof RefillError);
      assert.equal(error.code, 'COMPLETED_WITH_DIFFERENT_CANISTER');
      assert.equal(error.status, 409);
      assert.equal(toRefillHttp(error).status, 409);
      assert.equal(toRefillHttp(error).body.code, 'COMPLETED_WITH_DIFFERENT_CANISTER');
      return true;
    });
    assert.equal(writes.length, 0);
    assert.equal(state.audits.length, 0);
    assert.equal(state.ledger.length, 0);
    assert.equal(notifications.length, 0);
    assert.equal(state.orders[0].status, 'completed');
    assert.equal(state.orders[0].newContainerSerial, '33333333');
  });

  it('已完成但沒有新罐序號時保守回 409，而且沒有副作用', async () => {
    reset({
      orders: [order({ status: 'completed', newContainerSerial: null })],
    });
    await assert.rejects(complete(), (error: unknown) => {
      assert.ok(error instanceof RefillError);
      assert.equal(error.code, 'COMPLETED_WITH_DIFFERENT_CANISTER');
      assert.equal(error.status, 409);
      return true;
    });
    assert.equal(writes.length, 0);
    assert.equal(notifications.length, 0);
    assert.equal(state.orders[0].newContainerSerial, null);
    assert.equal(state.audits.length, 0);
    assert.equal(state.ledger.length, 0);
  });

  it('新罐 CAS 失敗後不再記點數、稽核或通知', async () => {
    forceCount['jar-new'] = 0;
    await assert.rejects(complete(), (error: unknown) => {
      assert.ok(error instanceof RefillError);
      assert.equal(error.code, 'SERIAL_USED');
      assert.equal(error.status, 409);
      return true;
    });
    assertNoFollowUp('tx.jar-new.updateMany');
    assert.equal(state.orders[0].status, 'old_container_verified');
    assert.equal(state.jars.find((item) => item.code === OLD_CODE)?.status, 'issued');
    assert.equal(state.jars.find((item) => item.code === NEW_CODE)?.status, 'unused');
    assert.equal(state.ledger.length, 0);
    assert.equal(state.audits.length, 0);
  });

  it('舊罐 CAS 失敗後不再發出新罐、記點數、稽核或通知', async () => {
    forceCount['jar-old'] = 0;
    await assert.rejects(complete(), (error: unknown) => {
      assert.ok(error instanceof RefillError);
      assert.equal(error.code, 'SERIAL_NOT_OWNED');
      assert.equal(error.status, 409);
      return true;
    });
    assert.equal(writes.some((item) => item.model === 'jar-new'), false);
    assert.equal(seq.includes('tx.memberPointsLedger.create'), false);
    assert.equal(seq.includes('tx.refillAuditLog.create'), false);
    assert.equal(notifications.length, 0);
    assert.equal(state.jars.find((item) => item.code === OLD_CODE)?.status, 'issued');
    assert.equal(state.jars.find((item) => item.code === NEW_CODE)?.status, 'unused');
  });

  it('訂單 CAS 失敗後不再稽核或通知，交易內寫入也不留下', async () => {
    forceCount.order = 0;
    await assert.rejects(complete(), (error: unknown) => {
      assert.ok(error instanceof RefillError);
      assert.equal(error.code, 'INVALID_STATUS');
      assert.equal(error.status, 409);
      return true;
    });
    const at = seq.lastIndexOf('tx.order.updateMany');
    assert.equal(seq.slice(at + 1).includes('tx.refillAuditLog.create'), false);
    assert.equal(seq.slice(at + 1).includes('tx.memberPointsLedger.create'), false);
    assert.equal(notifications.length, 0);
    assert.equal(state.orders[0].status, 'old_container_verified');
    assert.equal(state.ledger.length, 0);
    assert.equal(state.audits.length, 0);
    assert.equal(state.jars.find((item) => item.code === NEW_CODE)?.redeemedByCustomerId, null);
  });

  it('新罐序號與舊罐相同時直接拒絕', async () => {
    await assert.rejects(complete(OLD_CODE), (error: unknown) => {
      assert.ok(error instanceof RefillError);
      assert.equal(error.code, 'INVALID_SERIAL');
      assert.equal(error.status, 400);
      return true;
    });
    assert.equal(writes.length, 0);
    assert.equal(jarLockSqls().length, 0);
    assert.equal(notifications.length, 0);
    assert.equal(state.orders[0].status, 'old_container_verified');
    assert.equal(state.ledger.length, 0);
  });

  it('通知只出現在真正完成的那一次', async () => {
    await complete();
    assert.equal(notifications.length, 1);
    await complete();
    assert.equal(notifications.length, 1);
    assert.equal(state.ledger.length, 1);
    assert.equal(state.audits.length, 1);
  });

  it('新罐 CAS 的寫入值與條件互斥；同罐第二張訂單搶輸時是 SERIAL_USED 且沒有後續副作用', async () => {
    await complete();
    const issued = writes.find((item) => item.model === 'jar-new');
    assert.ok(issued);
    assert.equal(issued.data.status, 'issued');
    assert.notEqual(issued.data.redeemedByCustomerId, null);
    assert.equal(issued.data.redeemedByCustomerId, CUSTOMER);
    const unusedRow: Row = {
      id: issued.where.id,
      status: 'unused',
      redeemedByCustomerId: null,
    };
    const openIssuedRow: Row = {
      id: issued.where.id,
      status: 'issued',
      redeemedByCustomerId: null,
    };
    assert.equal(matchesWhere(unusedRow, issued.where), true);
    assert.equal(matchesWhere(openIssuedRow, issued.where), true);
    assert.equal(matchesWhere({ ...unusedRow, ...issued.data }, issued.where), false);
    assert.equal(matchesWhere({ ...openIssuedRow, ...issued.data }, issued.where), false);

    reset({
      orders: [order({ id: 'order_2' })],
      jars: [
        jar({
          id: 'jar_a',
          code: OLD_CODE,
          status: 'issued',
          redeemedByCustomerId: CUSTOMER,
          lockedByRefillOrderId: 'order_2',
        }),
        jar({ id: 'jar_b', code: NEW_CODE, status: 'unused' }),
      ],
    });
    forceCount['jar-new'] = 0;
    await assert.rejects(complete(NEW_CODE, 'order_2'), (error: unknown) => {
      assert.ok(error instanceof RefillError);
      assert.equal(error.code, 'SERIAL_USED');
      assert.equal(error.status, 409);
      return true;
    });
    assertNoFollowUp('tx.jar-new.updateMany');
    assert.equal(state.ledger.length, 0);
    assert.equal(state.audits.length, 0);
    assert.equal(state.jars.find((item) => item.id === 'jar_b')?.redeemedByCustomerId, null);
  });
});
