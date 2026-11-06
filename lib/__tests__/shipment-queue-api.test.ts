import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function api(authenticated = true, mutationResult: object = { ok: true, shipmentId: 's1', next: 'shipped' }) {
  const writes: FormData[] = [];
  const output = ts.transpileModule(readFileSync('app/api/shipments/[id]/status/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded: Record<string, Function> = {};
  new Function('require', 'exports', output)((name: string) => {
    if (name === '@/lib/auth') return { getCurrentUser: async () => authenticated ? { userId: 'hq' } : null };
    if (name === '@/lib/prisma') return { prisma: { shipment: { findUnique: async () => ({ id: 's1', status: 'shipped', order: { id: 'o1', omsStatus: 'FULFILLMENT_PENDING', omsReviewedAt: null, omsReviewedById: null, omsCheckedAt: new Date('2026-11-01T00:00:00Z'), omsCheckedSourceUpdatedAt: null, shopifySourceUpdatedAt: null, deletedAt: null, omsIssueFlags: [{ code: 'SAFE', severity: 'warning', blocking: false, message: 'private recipient detail' }] } }) } } };
    if (name === '@/app/(main)/shipments/actions') return { markShipmentStatusFromQueue: async (data: FormData) => { writes.push(data); return mutationResult; } };
    throw new Error(`Unexpected dependency: ${name}`);
  }, loaded);
  return { loaded, writes };
}
const context = () => ({ params: Promise.resolve({ id: 's1' }) });
function request(origin = 'https://hq.example', body = { next: 'shipped', shipmentId: 'other' }) {
  return new Request('https://hq.example/api/shipments/s1/status', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('JSON shipment endpoints reject a missing HQ login without writing', async () => {
  const { loaded, writes } = api(false);
  assert.equal((await loaded.POST(request(), context())).status, 401);
  assert.equal((await loaded.GET(request(), context())).status, 401);
  assert.equal((await loaded.GET(new Request('https://hq.example/api/shipments/s1/status?diagnostic=1'), context())).status, 401);
  assert.equal(writes.length, 0);
});
test('cross-origin and malformed origins are rejected without writing', async () => {
  const { loaded, writes } = api();
  for (const origin of ['https://attacker.example', 'null', '']) {
    assert.equal((await loaded.POST(request(origin), context())).status, 403);
  }
  assert.equal(writes.length, 0);
});
test('JSON mutation reuses the existing gated action and route shipment identity', async () => {
  const { loaded, writes } = api();
  const response = await loaded.POST(request(), context());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].get('shipmentId'), 's1');
  assert.equal(writes[0].get('next'), 'shipped');
});
test('failed transaction or OMS gate produces a visible conflict result', async () => {
  const { loaded } = api(true, { ok: false, error: '請先完成審核' });
  const response = await loaded.POST(request(), context());
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { ok: false, error: '請先完成審核' });
});
test('read-only reconciliation returns durable status with no write or cache', async () => {
  const { loaded, writes } = api();
  const response = await loaded.GET(request(), context());
  assert.deepEqual(await response.json(), { ok: true, shipmentId: 's1', status: 'shipped' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(writes.length, 0);
});

test('authenticated diagnostic is read-only and exposes review evidence without customer fields', async () => {
  const { loaded, writes } = api();
  const response = await loaded.GET(new Request('https://hq.example/api/shipments/s1/status?diagnostic=1'), context());
  const body = await response.json();
  assert.equal(body.diagnostic.orderId, 'o1');
  assert.equal(body.diagnostic.reviewedAt, null);
  assert.equal(body.diagnostic.reviewerRecorded, false);
  assert.deepEqual(body.diagnostic.issues, [{ code: 'SAFE', severity: 'warning', blocking: false }]);
  assert.equal(JSON.stringify(body).includes('private recipient detail'), false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(writes.length, 0);
});
