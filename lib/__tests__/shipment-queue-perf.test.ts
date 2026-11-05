import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { SHIPMENT_KIND_KEYS } from '@/lib/order-hub-kinds';
import { SHIPMENT_STATUSES } from '@/lib/shipment';
import {
  SHIPMENT_QUEUE_PERF_EVENT,
  countShipmentQueueSamples,
  createShipmentQueuePerf,
  emptyShipmentQueuePerfCounts,
  isShipmentQueuePerfEnabled,
  readShipmentQueuePerfRequestContext,
  sanitizeVercelRequestId,
  type ShipmentQueuePerf,
  type ShipmentQueuePerfCounts,
  type ShipmentQueuePerfLogInput,
  type ShipmentQueuePerfRequestContext,
} from '@/lib/shipment-queue-perf';

const ALLOWED_LOG_KEYS = new Set([
  'event',
  'status',
  'type',
  'success',
  'requestId',
  'fetchMode',
  'fetchDest',
  'fetchPurpose',
  'findManyMs',
  'countsMs',
  'jibaMs',
  'transformMs',
  'totalMs',
  'shipmentCount',
  'itemCount',
  'priceTierCount',
  'inventoryBalanceCount',
  'orderIdCount',
  'errorCategory',
  'errorCode',
]);

const REQUIRED_LOG_KEYS = [
  'event',
  'status',
  'type',
  'success',
  'requestId',
  'fetchMode',
  'fetchDest',
  'fetchPurpose',
  'findManyMs',
  'countsMs',
  'jibaMs',
  'transformMs',
  'totalMs',
  'shipmentCount',
  'itemCount',
  'priceTierCount',
  'inventoryBalanceCount',
  'orderIdCount',
] as const;

const DURATION_KEYS = ['findManyMs', 'countsMs', 'jibaMs', 'transformMs', 'totalMs'] as const;
const COUNT_KEYS = [
  'shipmentCount',
  'itemCount',
  'priceTierCount',
  'inventoryBalanceCount',
  'orderIdCount',
] as const;
const FETCH_MODE_ALLOWLIST = new Set([
  'navigate',
  'cors',
  'no-cors',
  'same-origin',
  'websocket',
  'unknown',
  'other',
]);
const FETCH_DEST_ALLOWLIST = new Set([
  'document',
  'empty',
  'script',
  'style',
  'image',
  'iframe',
  'worker',
  'serviceworker',
  'font',
  'manifest',
  'unknown',
  'other',
]);
const FETCH_PURPOSE_ALLOWLIST = new Set(['prefetch', 'unknown', 'other']);
const ERROR_CODES = new Set(['FIND_MANY', 'COUNTS', 'JIBA', 'TRANSFORM', 'UNATTRIBUTED']);
const ERROR_CATEGORIES = new Set(['segment_rejected', 'unattributed']);

const BODY_PATH = 'app/(main)/shipments/shipments-queue-body.tsx';
const HELPER_PATH = 'lib/shipment-queue-perf.ts';
const CANARY_SECRET = 'canary-secret-DO-NOT-LEAK-9f3a2c';

let logs: unknown[][] = [];
let originalInfo: typeof console.info;
const previousFlag = process.env.SHIPMENTS_PERF_LOG;
const previousVercelEnv = process.env.VERCEL_ENV;

beforeEach(() => {
  logs = [];
  originalInfo = console.info;
  console.info = (...args: unknown[]) => {
    logs.push(args);
  };
  delete process.env.SHIPMENTS_PERF_LOG;
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  console.info = originalInfo;
  if (previousFlag === undefined) delete process.env.SHIPMENTS_PERF_LOG;
  else process.env.SHIPMENTS_PERF_LOG = previousFlag;
  if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previousVercelEnv;
});

function zeroCounts(): ShipmentQueuePerfCounts {
  return emptyShipmentQueuePerfCounts();
}

function sampleInput(overrides: Partial<ShipmentQueuePerfLogInput> = {}): ShipmentQueuePerfLogInput {
  return {
    status: 'pending',
    type: 'customer_order',
    counts: {
      shipmentCount: 2,
      itemCount: 3,
      priceTierCount: 4,
      inventoryBalanceCount: 5,
      orderIdCount: 2,
    },
    ...overrides,
  };
}

function headerStore(entries: Record<string, string | null>): {
  get(name: string): string | null;
} {
  const normalized = new Map<string, string | null>();
  for (const [key, value] of Object.entries(entries)) {
    normalized.set(key.toLowerCase(), value);
  }
  return {
    get(name: string) {
      return normalized.has(name.toLowerCase()) ? (normalized.get(name.toLowerCase()) ?? null) : null;
    },
  };
}

function sampleRequestContext(
  overrides: Partial<ShipmentQueuePerfRequestContext> = {},
): ShipmentQueuePerfRequestContext {
  return {
    requestId: 'iad1::abc-def',
    fetchMode: 'navigate',
    fetchDest: 'document',
    fetchPurpose: 'unknown',
    ...overrides,
  };
}

function oneLine(): Record<string, unknown> {
  assert.equal(logs.length, 1);
  assert.equal(logs[0].length, 1);
  const line = logs[0][0];
  assert.equal(typeof line, 'object');
  assert.notEqual(line, null);
  assert.equal(Array.isArray(line), false);
  return line as Record<string, unknown>;
}

function assertAllowlisted(line: Record<string, unknown>, success: boolean) {
  for (const key of Object.keys(line)) {
    assert.equal(ALLOWED_LOG_KEYS.has(key), true, key);
  }
  for (const key of REQUIRED_LOG_KEYS) {
    assert.equal(Object.hasOwn(line, key), true, key);
  }
  assert.equal(line.event, 'hq.shipments.queue.perf');
  assert.equal(line.event, SHIPMENT_QUEUE_PERF_EVENT);
  assert.equal(line.success, success);
  assert.equal(typeof line.status, 'string');
  assert.equal(typeof line.type, 'string');
  if (line.status !== '') assert.equal(SHIPMENT_STATUSES.includes(line.status as never), true);
  if (line.type !== '') assert.equal(SHIPMENT_KIND_KEYS.includes(line.type as never), true);
  assert.equal(line.requestId === null || typeof line.requestId === 'string', true);
  assert.equal(FETCH_MODE_ALLOWLIST.has(String(line.fetchMode)), true, String(line.fetchMode));
  assert.equal(FETCH_DEST_ALLOWLIST.has(String(line.fetchDest)), true, String(line.fetchDest));
  assert.equal(FETCH_PURPOSE_ALLOWLIST.has(String(line.fetchPurpose)), true, String(line.fetchPurpose));
  for (const key of DURATION_KEYS) {
    assert.equal(typeof line[key], 'number');
    assert.equal(Number.isInteger(line[key]), true);
    assert.equal((line[key] as number) >= 0, true);
  }
  for (const key of COUNT_KEYS) {
    assert.equal(typeof line[key], 'number');
    assert.equal(Number.isInteger(line[key]), true);
    assert.equal((line[key] as number) >= 0, true);
  }
  if (success) {
    assert.equal(Object.hasOwn(line, 'errorCategory'), false);
    assert.equal(Object.hasOwn(line, 'errorCode'), false);
    return;
  }
  assert.equal(ERROR_CATEGORIES.has(String(line.errorCategory)), true);
  assert.equal(ERROR_CODES.has(String(line.errorCode)), true);
}

function assertValuesHide(line: Record<string, unknown>, secrets: string[]) {
  for (const value of Object.values(line)) {
    const text = String(value);
    for (const secret of secrets) {
      assert.equal(text.includes(secret), false, secret);
    }
  }
}

async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('shipment queue performance diagnostics', () => {
  it('missing or wrong flags keep diagnostics off and skip header reads', () => {
    const cases: Array<{ vercel?: string; flag?: string }> = [
      {},
      { vercel: 'preview' },
      { flag: '1' },
      { vercel: 'production', flag: '1' },
      { vercel: 'development', flag: '1' },
      { vercel: 'preview', flag: '' },
      { vercel: 'preview', flag: '0' },
      { vercel: 'preview', flag: 'true' },
      { vercel: 'preview', flag: 'yes' },
      { vercel: 'preview', flag: ' 1' },
      { vercel: 'Preview', flag: '1' },
    ];
    for (const entry of cases) {
      delete process.env.VERCEL_ENV;
      delete process.env.SHIPMENTS_PERF_LOG;
      if (entry.vercel !== undefined) process.env.VERCEL_ENV = entry.vercel;
      if (entry.flag !== undefined) process.env.SHIPMENTS_PERF_LOG = entry.flag;
      assert.equal(isShipmentQueuePerfEnabled(), false, JSON.stringify(entry));
      const perf = createShipmentQueuePerf();
      assert.equal(perf.enabled, false, JSON.stringify(entry));
      perf.succeed(sampleInput());
    }
    assert.equal(logs.length, 0);
  });

  it('exact Preview enablement turns logging on', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.SHIPMENTS_PERF_LOG = '1';
    assert.equal(isShipmentQueuePerfEnabled(), true);
    const enabled = createShipmentQueuePerf({
      requestContext: sampleRequestContext({ fetchPurpose: 'prefetch' }),
    });
    assert.equal(enabled.enabled, true);
    enabled.succeed(sampleInput({ type: 'subscription' }));
    const line = oneLine();
    assertAllowlisted(line, true);
    assert.equal(line.type, 'subscription');
    assert.equal(line.requestId, 'iad1::abc-def');
    assert.equal(line.fetchMode, 'navigate');
    assert.equal(line.fetchDest, 'document');
    assert.equal(line.fetchPurpose, 'prefetch');
  });

  it('off means zero logs and preserves the returned promise', async () => {
    const perf = createShipmentQueuePerf();
    const payload = { id: 'same-object' };
    const pending = Promise.resolve(payload);
    assert.equal(perf.enabled, false);
    assert.equal(perf.measure('findMany', () => pending), pending);
    assert.equal(await perf.measure('counts', async () => payload), payload);
    assert.equal(perf.measureSync(() => payload), payload);
    perf.succeed(sampleInput());
    perf.fail(sampleInput());
    assert.equal(logs.length, 0);
  });

  it('sanitizes missing malformed and oversized request ids', () => {
    assert.equal(sanitizeVercelRequestId(null), null);
    assert.equal(sanitizeVercelRequestId(undefined), null);
    assert.equal(sanitizeVercelRequestId(''), null);
    assert.equal(sanitizeVercelRequestId('  iad1::ok'), null);
    assert.equal(sanitizeVercelRequestId('iad1::ok '), null);
    assert.equal(sanitizeVercelRequestId(`bad ${CANARY_SECRET}`), null);
    assert.equal(sanitizeVercelRequestId(`${CANARY_SECRET}<script>`), null);
    assert.equal(sanitizeVercelRequestId('a'.repeat(129)), null);
    assert.equal(sanitizeVercelRequestId('iad1::ok-request_1.2'), 'iad1::ok-request_1.2');
    assert.equal(sanitizeVercelRequestId('a'.repeat(128)), 'a'.repeat(128));

    const missing = readShipmentQueuePerfRequestContext(headerStore({}));
    assert.deepEqual(missing, {
      requestId: null,
      fetchMode: 'unknown',
      fetchDest: 'unknown',
      fetchPurpose: 'unknown',
    });

    const malformed = readShipmentQueuePerfRequestContext(
      headerStore({
        'x-vercel-id': `leak ${CANARY_SECRET}`,
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
        'sec-purpose': 'prefetch',
      }),
    );
    assert.equal(malformed.requestId, null);
    assert.equal(malformed.fetchMode, 'navigate');
    assert.equal(malformed.fetchDest, 'document');
    assert.equal(malformed.fetchPurpose, 'prefetch');
    assert.equal(JSON.stringify(malformed).includes(CANARY_SECRET), false);

    const oversized = readShipmentQueuePerfRequestContext(
      headerStore({
        'x-vercel-id': `${'a'.repeat(100)}${CANARY_SECRET}`,
      }),
    );
    assert.equal(oversized.requestId, null);
    assert.equal(JSON.stringify(oversized).includes(CANARY_SECRET), false);
  });

  it('normalizes allowlisted fetch metadata and maps unknown values', () => {
    const normalized = readShipmentQueuePerfRequestContext(
      headerStore({
        'x-vercel-id': 'fra1::req-1',
        'sec-fetch-mode': ' Navigate ',
        'sec-fetch-dest': 'DOCUMENT',
        'sec-purpose': ' Prefetch ',
      }),
    );
    assert.deepEqual(normalized, {
      requestId: 'fra1::req-1',
      fetchMode: 'navigate',
      fetchDest: 'document',
      fetchPurpose: 'prefetch',
    });

    const unknown = readShipmentQueuePerfRequestContext(
      headerStore({
        'x-vercel-id': 'fra1::req-2',
        'sec-fetch-mode': `cors;${CANARY_SECRET}`,
        'sec-fetch-dest': CANARY_SECRET,
        'sec-purpose': `prefetch;${CANARY_SECRET}`,
      }),
    );
    assert.deepEqual(unknown, {
      requestId: 'fra1::req-2',
      fetchMode: 'other',
      fetchDest: 'other',
      fetchPurpose: 'other',
    });
    assert.equal(JSON.stringify(unknown).includes(CANARY_SECRET), false);
  });

  it('on produces only allowlisted keys and preserves the return value', async () => {
    let clock = 0;
    const perf = createShipmentQueuePerf({
      enabled: true,
      now: () => clock,
      requestContext: sampleRequestContext({
        requestId: null,
        fetchMode: 'cors',
        fetchDest: 'empty',
        fetchPurpose: 'other',
      }),
    });
    const rows = [{ id: 'row-secret' }];
    const counts = { total: 4, label: 'name-secret' };
    const measuredRows = await perf.measure('findMany', async () => {
      clock = 20;
      return rows;
    });
    const measuredCounts = await perf.measure('counts', async () => {
      clock = 25;
      return counts;
    });
    assert.equal(measuredRows, rows);
    assert.equal(measuredCounts, counts);

    const fees = new Map<string, string>([['order-1', 'fee-secret']]);
    const measuredFees = await perf.measure('jiba', async () => {
      clock = 30;
      return fees;
    });
    const projected = [{ productName: 'product-secret' }];
    const measuredRowsProjected = perf.measureSync(() => {
      clock = 36;
      return projected;
    });
    assert.equal(measuredFees, fees);
    assert.equal(measuredRowsProjected, projected);

    clock = 40;
    perf.succeed(
      sampleInput({
        status: 'pending<script>',
        type: 'buyer@example.com',
        counts: countShipmentQueueSamples(
          [
            {
              items: [
                {
                  product: {
                    priceTiers: [{ id: 'tier-secret' }, { id: 'tier-secret-2' }],
                    inventoryBalances: [{ quantity: 999 }],
                    inventorySourceProduct: {
                      inventoryBalances: [{ quantity: 7 }, { quantity: 8 }],
                    },
                  },
                },
              ],
            },
          ],
          ['order-secret', null],
        ),
      }),
    );

    const line = oneLine();
    assertAllowlisted(line, true);
    assert.equal(line.status, '');
    assert.equal(line.type, '');
    assert.equal(line.requestId, null);
    assert.equal(line.fetchMode, 'cors');
    assert.equal(line.fetchDest, 'empty');
    assert.equal(line.fetchPurpose, 'other');
    assert.equal(line.shipmentCount, 1);
    assert.equal(line.itemCount, 1);
    assert.equal(line.priceTierCount, 2);
    assert.equal(line.inventoryBalanceCount, 3);
    assert.equal(line.orderIdCount, 2);
    assert.equal(line.findManyMs, 20);
    assert.equal(line.countsMs, 5);
    assert.equal(line.jibaMs, 5);
    assert.equal(line.transformMs, 6);
    assert.equal(line.totalMs, 40);
    assertValuesHide(line, [
      'row-secret',
      'name-secret',
      'fee-secret',
      'product-secret',
      'tier-secret',
      'order-secret',
      'buyer@example.com',
      '999',
      '<script>',
      CANARY_SECRET,
    ]);
    perf.succeed(sampleInput());
    assert.equal(logs.length, 1);
  });

  it('rethrows the original error object', async () => {
    const perf = createShipmentQueuePerf({ enabled: true, now: () => 0 });
    const asyncError = new Error('async-secret');
    asyncError.name = 'PrismaClientKnownRequestError';
    await assert.rejects(
      () => perf.measure('jiba', () => Promise.reject(asyncError)),
      (error) => error === asyncError,
    );

    const syncError = new Error('sync-secret');
    assert.throws(
      () =>
        perf.measureSync(() => {
          throw syncError;
        }),
      (error) => error === syncError,
    );

    const disabled = createShipmentQueuePerf({ enabled: false });
    const disabledError = new Error('disabled-secret');
    assert.throws(
      () =>
        disabled.measureSync(() => {
          throw disabledError;
        }),
      (error) => error === disabledError,
    );
    await assert.rejects(
      () => disabled.measure('findMany', () => Promise.reject(disabledError)),
      (error) => error === disabledError,
    );
    assert.equal(logs.length, 0);
  });

  it('a throwing console.info still returns the exact measured value', async () => {
    const loggerError = new Error('logger-secret');
    console.info = () => {
      throw loggerError;
    };
    const payload = { id: 'original-value' };
    let measured: typeof payload | undefined;
    let escaped: unknown;
    try {
      const perf = createShipmentQueuePerf({ enabled: true, now: () => 0 });
      try {
        measured = await perf.measure('findMany', async () => payload);
        perf.succeed(sampleInput());
      } catch (error) {
        escaped = error;
      }
      assert.equal(escaped, undefined);
      assert.equal(measured, payload);
      assert.notEqual(escaped, loggerError);
    } finally {
      console.info = originalInfo;
    }
  });

  it('a throwing console.info still exposes the exact measured error', async () => {
    const loggerError = new Error('logger-secret');
    console.info = () => {
      throw loggerError;
    };
    const workError = new Error('work-secret');
    workError.name = 'PrismaClientKnownRequestError';
    let surfaced: unknown = loggerError;
    try {
      const perf = createShipmentQueuePerf({ enabled: true, now: () => 0 });
      try {
        try {
          await perf.measure('counts', () => Promise.reject(workError));
        } catch (error) {
          perf.fail(sampleInput({ counts: zeroCounts() }));
          surfaced = error;
        }
      } catch (error) {
        surfaced = error;
      }
      assert.equal(surfaced, workError);
      assert.notEqual(surfaced, loggerError);
    } finally {
      console.info = originalInfo;
    }
  });

  it('a rejected measured segment produces exactly one success:false log line', async () => {
    let releaseRows: (value: string) => void = () => {};
    const rowsGate = new Promise<string>((resolve) => {
      releaseRows = resolve;
    });
    const countsError = new Error('counts-secret');
    Object.assign(countsError, { code: 'P2002', stack: 'stack-secret' });
    const perf = createShipmentQueuePerf({
      enabled: true,
      now: () => 0,
      requestContext: sampleRequestContext(),
    });

    let caught: unknown;
    try {
      await loadLikeQueue(perf, {
        findMany: () => rowsGate,
        counts: () => Promise.reject(countsError),
        jiba: async () => new Map(),
        transform: () => [],
      });
    } catch (error) {
      caught = error;
    }

    assert.equal(caught, countsError);
    const line = oneLine();
    assertAllowlisted(line, false);
    assert.equal(line.success, false);
    assert.equal(line.errorCategory, 'segment_rejected');
    assert.equal(line.errorCode, 'COUNTS');
    assert.equal(line.requestId, 'iad1::abc-def');
    assertValuesHide(line, ['counts-secret', 'P2002', 'stack-secret', CANARY_SECRET]);
    perf.fail(sampleInput());
    perf.succeed(sampleInput());
    assert.equal(logs.length, 1);

    releaseRows('done');
    await flushMicrotasks();
  });

  it('independent async measurements keep Promise.all concurrency', async () => {
    let clock = 0;
    const perf = createShipmentQueuePerf({ enabled: true, now: () => clock });
    let releaseRows: (value: string[]) => void = () => {};
    let releaseCounts: (value: { total: number }) => void = () => {};
    const rowsGate = new Promise<string[]>((resolve) => {
      releaseRows = resolve;
    });
    const countsGate = new Promise<{ total: number }>((resolve) => {
      releaseCounts = resolve;
    });
    let rowsStarted = false;
    let countsStarted = false;

    const pending = Promise.all([
      perf.measure('findMany', () => {
        rowsStarted = true;
        return rowsGate;
      }),
      perf.measure('counts', () => {
        countsStarted = true;
        return countsGate;
      }),
    ]);
    assert.equal(rowsStarted, true);
    assert.equal(countsStarted, true);

    clock = 10;
    releaseCounts({ total: 3 });
    await flushMicrotasks();

    clock = 50;
    releaseRows(['kept-row']);
    const [rows, counts] = await pending;
    assert.deepEqual(rows, ['kept-row']);
    assert.deepEqual(counts, { total: 3 });

    clock = 70;
    perf.succeed(sampleInput());
    const line = oneLine();
    assertAllowlisted(line, true);
    assert.equal(line.findManyMs, 50);
    assert.equal(line.countsMs, 10);
    assert.equal(line.totalMs, 70);
    assert.notEqual(line.totalMs, (line.findManyMs as number) + (line.countsMs as number));

    let rejectionClock = 0;
    const rejectionPerf = createShipmentQueuePerf({
      enabled: true,
      now: () => rejectionClock,
    });
    let slowFinished = false;
    let releaseSlow: () => void = () => {};
    const slow = new Promise<{ total: number }>((resolve) => {
      releaseSlow = () => {
        slowFinished = true;
        resolve({ total: 1 });
      };
    });
    const fastError = new Error('findMany-secret');
    let slowStarted = false;
    try {
      await Promise.all([
        rejectionPerf.measure('findMany', () => {
          rejectionClock = 25;
          return Promise.reject(fastError);
        }),
        rejectionPerf.measure('counts', () => {
          slowStarted = true;
          rejectionClock = 40;
          return slow;
        }),
      ]);
      throw new Error('expected the fast segment to reject');
    } catch (error) {
      assert.equal(error, fastError);
    }
    assert.equal(slowStarted, true);
    assert.equal(slowFinished, false);
    rejectionPerf.fail(sampleInput({ counts: zeroCounts() }));
    assert.equal(logs.length, 2);
    const failure = logs[1][0] as Record<string, unknown>;
    assertAllowlisted(failure, false);
    assert.equal(failure.errorCode, 'FIND_MANY');
    assert.equal(failure.findManyMs, 40);
    assert.equal(failure.countsMs, 0);
    assertValuesHide(failure, ['findMany-secret']);
    releaseSlow();
    await flushMicrotasks();
  });

  it('source guard keeps query arguments, JSX, and Promise.all in place', () => {
    const body = readFileSync(BODY_PATH, 'utf8');
    const helper = readFileSync(HELPER_PATH, 'utf8');
    const parallelStart = body.indexOf('await Promise.all([');
    const parallelEnd = body.indexOf(']);', parallelStart);
    const parallel = body.slice(parallelStart, parallelEnd);
    const enrichmentStart = body.indexOf('await Promise.all([', parallelEnd);
    const enrichmentEnd = body.indexOf(']);', enrichmentStart);
    const enrichment = body.slice(enrichmentStart, enrichmentEnd);

    assert.equal((body.match(/Promise\.all\(/g) ?? []).length, 2);
    assert.match(parallel, /perf\.measure\('findMany'/);
    assert.match(parallel, /perf\.measure\('counts'/);
    assert.match(
      parallel,
      /prisma\.shipment\.findMany\(\{\s*where,\s*include:\s*shipmentInclude,\s*orderBy:\s*\[\{\s*status:\s*'asc'\s*\},\s*\{\s*createdAt:\s*'desc'\s*\}\],\s*take:\s*SHIPMENT_QUEUE_TAKE,\s*\}\)/,
    );
    assert.match(parallel, /getShipmentQueueCounts\(countWhere\)/);
    assert.equal(parallel.indexOf('findMany') < parallel.indexOf('getShipmentQueueCounts'), true);
    assert.equal(body.includes('await prisma.shipment.findMany'), false);
    assert.equal(body.includes('await getShipmentQueueCounts'), false);
    assert.match(body, /shipments\.map\(\(s\) => s\.orderId\)/);
    assert.match(enrichment, /loadJibaChargeSourcesByOrderIds\(orderIds\)/);
    assert.match(enrichment, /prisma\.productPriceTier\.findMany/);
    assert.match(enrichment, /prisma\.inventoryBalance\.findMany/);
    assert.match(enrichment, /warehouse: \{ code: 'WH-MAIN' \}/);
    const includeStart = body.indexOf('const shipmentInclude =');
    const includeEnd = body.indexOf('} as const;', includeStart);
    const shipmentInclude = body.slice(includeStart, includeEnd);
    assert.equal(shipmentInclude.includes('priceTiers'), false);
    assert.equal(shipmentInclude.includes('inventoryBalances'), false);
    assert.match(body, /tiersByProductId/);
    assert.match(body, /balanceByProductId/);
    assert.match(body, /shipmentInventoryAdvisories\(queueInventoryItems\(s, enrichment\)\)/);
    assert.match(body, /<ShipmentQueueWorkspace\s+sections=\{workspaceSections\}\s+statusFilter=\{status\}\s+typeFilter=\{type\}\s+panelRefreshKey=\{panelRefreshKey\}\s+initialShipmentId=\{selectedShipmentId\}\s*\/>/);
    assert.match(body, /aria-label="出貨階段"/);
    assert.match(body, /bg-black text-white shadow-sm/);
    assert.match(body, /catch \(error\) \{[\s\S]*perf\.fail\([\s\S]*throw error;\s*\}/);
    assert.equal((body.match(/perf\.succeed\(/g) ?? []).length, 1);
    assert.equal((body.match(/perf\.fail\(/g) ?? []).length, 1);
    assert.equal(body.includes('console.info'), false);
    assert.equal(body.includes('JSON.stringify'), false);
    assert.equal(body.includes('error.message'), false);
    assert.equal(body.includes('error.stack'), false);
    assert.match(body, /isShipmentQueuePerfEnabled\(\)/);
    assert.match(body, /perfEnabled\s*\?\s*readShipmentQueuePerfRequestContext\(await headers\(\)\)/);
    assert.equal(body.includes('cache('), false);
    assert.equal(/requestId|fetchMode|fetchDest|fetchPurpose/.test(
      body.slice(body.indexOf('return ('), body.length),
    ), false);

    assert.match(helper, /VERCEL_ENV === 'preview'/);
    assert.match(helper, /SHIPMENTS_PERF_LOG === '1'/);
    assert.match(helper, /x-vercel-id/);
    assert.match(helper, /sec-fetch-mode/);
    assert.match(helper, /sec-fetch-dest/);
    assert.match(helper, /sec-purpose/);
    assert.equal((helper.match(/console\.info\(/g) ?? []).length, 1);
    assert.equal(helper.includes('console.log'), false);
    assert.equal(helper.includes('console.error'), false);
    assert.equal(helper.includes('console.debug'), false);
    assert.equal(helper.includes('JSON.stringify'), false);
    assert.equal(helper.includes('.message'), false);
    assert.equal(helper.includes('.stack'), false);
    assert.equal(helper.includes('prisma'), false);
    assert.equal(helper.includes("from 'next/headers'"), false);
    assert.equal(helper.includes('cache('), false);
  });
});

async function loadLikeQueue(
  perf: ShipmentQueuePerf,
  steps: {
    findMany: () => Promise<string>;
    counts: () => Promise<{ total: number }>;
    jiba: () => Promise<Map<string, string>>;
    transform: () => string[];
  },
): Promise<string[]> {
  try {
    const [rows] = await Promise.all([
      perf.measure('findMany', steps.findMany),
      perf.measure('counts', steps.counts),
    ]);
    await perf.measure('jiba', steps.jiba);
    const projected = perf.measureSync(steps.transform);
    perf.succeed(sampleInput());
    return projected.length > 0 ? projected : [rows];
  } catch (error) {
    perf.fail(sampleInput({ counts: zeroCounts() }));
    throw error;
  }
}
