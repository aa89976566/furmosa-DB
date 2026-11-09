import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { loadOrderWorkSummary } from '../work-summary';
import { ORDER_WORK_FILTERS, orderListVisibleWhere, orderWorkWhere, workbenchVisibleWhere } from '../oms-workbench';

test('work summary uses one transaction and serial counts with unchanged OMS/legacy filters', async () => {
  let transactions = 0;
  let active = 0;
  let peak = 0;
  const queries: unknown[] = [];
  const db = { async $transaction(run: (tx: unknown) => Promise<unknown>) {
    transactions++;
    return run({ order: { async count(query: unknown) {
      queries.push(query);
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setImmediate(resolve));
      active--;
      return queries.length;
    } } });
  } } as unknown as Pick<PrismaClient, '$transaction'>;
  const result = await loadOrderWorkSummary(db);
  assert.equal(transactions, 1);
  assert.equal(peak, 1);
  assert.equal(result.length, 7);
  for (const [index, stage] of ORDER_WORK_FILTERS.entries()) {
    assert.deepEqual(queries[index], { where: { AND: [stage.key === 'all' || stage.key === 'cancelled' ? orderListVisibleWhere : workbenchVisibleWhere, orderWorkWhere(stage.key)] } });
    assert.deepEqual(result[index], { ...stage, count: index + 1 });
  }
  assert.match(JSON.stringify(queries), /"omsStatus":null/, 'legacy order predicates remain included');
});

test('pool timeouts degrade to unknown counts without failing navigation or caching failure', async () => {
  let attempts = 0;
  const db = { async $transaction() { attempts++; throw Object.assign(new Error('pool timeout'), { code: 'P2024' }); } } as unknown as Pick<PrismaClient, '$transaction'>;
  const result = await loadOrderWorkSummary(db);
  assert.equal(result.length, 7);
  assert.ok(result.every(stage => stage.count === null));
  assert.deepEqual(result.map(({key,label}) => ({key,label})), ORDER_WORK_FILTERS);
  await loadOrderWorkSummary(db);
  assert.equal(attempts, 2, 'the next page request can recover');
});

test('summary failure diagnostics distinguish transaction start, count and finish without leaking error data', async () => {
  const original = console.error;
  const logs: unknown[][] = [];
  console.error = (...args) => { logs.push(args); };
  const secret = 'postgresql://private-user:private-password@private-host/private-db';
  try {
    for (const failure of ['start', 'count', 'finish'] as const) {
      const db = { async $transaction(run: (tx: unknown) => Promise<unknown>) {
        const error = Object.assign(new Error(secret), { code: failure === 'start' ? 'P2024' : failure === 'count' ? 'P2010' : secret, meta: { query: secret } });
        if (failure === 'start') throw error;
        let calls = 0;
        const result = await run({ order: { async count() {
          if (failure === 'count' && ++calls === 2) throw error;
          return 1;
        } } });
        if (failure === 'finish') throw error;
        return result;
      } } as unknown as Pick<PrismaClient, '$transaction'>;
      assert.ok((await loadOrderWorkSummary(db)).every(stage => stage.count === null));
    }
  } finally { console.error = original; }
  assert.equal(logs.length, 3);
  for (const [index, args] of logs.entries()) {
    assert.deepEqual(args.slice(0, 2), ['[orders.summary]', 'COUNTS_UNAVAILABLE']);
    const detail = args[2] as { phase: string; stage: string | null; code: string; elapsedMs: number };
    assert.equal(detail.phase, ['transaction_start', 'count', 'transaction_finish'][index]);
    assert.equal(detail.stage, index === 1 ? ORDER_WORK_FILTERS[1].key : null);
    assert.equal(detail.code, ['P2024', 'P2010', 'UNKNOWN'][index]);
    assert.ok(Number.isInteger(detail.elapsedMs) && detail.elapsedMs >= 0);
    assert.deepEqual(Object.keys(detail).sort(), ['code', 'elapsedMs', 'phase', 'stage']);
  }
  assert.ok(!JSON.stringify(logs).includes('private-'));
});
