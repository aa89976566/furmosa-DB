import assert from 'node:assert/strict';
import test from 'node:test';
import { checkReadiness, createReadinessProbe } from '../health';

const READY_ENV = {
  DATABASE_URL: 'postgresql://example.invalid/db',
  AUTH_SECRET: 'test-secret',
  NODE_ENV: 'test',
} as NodeJS.ProcessEnv;

for (const name of ['DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL']) {
  test(`readiness accepts ${name} independently`, async () => {
    let calls = 0;
    const result = await checkReadiness({
      env: { AUTH_SECRET: 'test', NODE_ENV: 'production', [name]: 'postgresql://example.invalid/db' },
      query: async () => { calls += 1; },
    });
    assert.equal(result.httpStatus, 200);
    assert.equal(calls, 1);
  });
}

test('readiness rejects whitespace configuration without querying', async () => {
  for (const name of ['DATABASE_URL', 'AUTH_SECRET', 'NODE_ENV']) {
    const result = await checkReadiness({
      env: { ...READY_ENV, [name]: '  ' },
      query: async () => { assert.fail('must not query'); },
    });
    assert.equal(result.httpStatus, 503);
    assert.equal(result.body.database, 'unknown');
  }
});

test('stalled probes time out without accumulating queries and recover after settlement', async () => {
  let calls = 0;
  let release!: () => void;
  const probe = createReadinessProbe(() => {
    calls += 1;
    return calls === 1 ? new Promise<void>((resolve) => { release = resolve; }) : Promise.resolve();
  }, 10);
  const run = () => checkReadiness({ env: READY_ENV, query: probe });
  const results = await Promise.all([run(), run()]);
  assert.ok(results.every((r) => r.httpStatus === 503 && r.body.database === 'error'));
  assert.equal(calls, 1);
  assert.equal((await run()).httpStatus, 503);
  assert.equal(calls, 1);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await run()).httpStatus, 200);
  assert.equal(calls, 2);
});

test('failed probes release in-flight state for recovery', async () => {
  let calls = 0;
  const probe = createReadinessProbe(async () => {
    if (++calls === 1) throw new Error('private connection details');
  });
  const result = await checkReadiness({ env: READY_ENV, query: probe });
  assert.equal(result.httpStatus, 503);
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal((await checkReadiness({ env: READY_ENV, query: probe })).httpStatus, 200);
});

test('readiness returns 200 after successful SELECT 1', async () => {
  let calls = 0;
  const clocks = [100, 112.34];
  const result = await checkReadiness({
    env: READY_ENV,
    query: async () => { calls += 1; },
    now: () => new Date('2026-09-07T08:00:00.000Z'),
    clock: () => clocks.shift() ?? 112.34,
  });

  assert.equal(calls, 1);
  assert.deepEqual(result, {
    httpStatus: 200,
    body: {
      status: 'ok',
      database: 'ok',
      latencyMs: 12.34,
      timestamp: '2026-09-07T08:00:00.000Z',
    },
  });
});

test('readiness never queries DB when required env is missing', async () => {
  let calls = 0;
  const result = await checkReadiness({
    env: { NODE_ENV: 'production' },
    query: async () => { calls += 1; },
    now: () => new Date('2026-09-07T08:00:00.000Z'),
  });

  assert.equal(calls, 0);
  assert.equal(result.httpStatus, 503);
  assert.equal(result.body.database, 'unknown');
  assert.equal(result.body.latencyMs, null);
});

test('readiness reports DB failure without leaking an error message', async () => {
  const clocks = [20, 27.5];
  const result = await checkReadiness({
    env: READY_ENV,
    query: async () => { throw new Error('postgresql://secret@host/db'); },
    now: () => new Date('2026-09-07T08:00:00.000Z'),
    clock: () => clocks.shift() ?? 27.5,
  });

  assert.deepEqual(result, {
    httpStatus: 503,
    body: {
      status: 'error',
      database: 'error',
      latencyMs: 7.5,
      timestamp: '2026-09-07T08:00:00.000Z',
    },
  });
  assert.equal(JSON.stringify(result).includes('secret'), false);
});
