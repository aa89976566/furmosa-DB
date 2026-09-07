import assert from 'node:assert/strict';
import test from 'node:test';
import { checkReadiness } from '../health';

const READY_ENV = {
  DATABASE_URL: 'postgresql://example.invalid/db',
  AUTH_SECRET: 'test-secret',
  NODE_ENV: 'test',
} as NodeJS.ProcessEnv;

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
