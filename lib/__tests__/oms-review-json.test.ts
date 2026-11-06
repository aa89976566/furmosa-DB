import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { requestOmsReview } from '../orders/review-request';

const result = { ok: true, action: 'check', message: '檢查通過，可以確認訂單', omsStatus: 'REVIEW', blockers: [], kind: 'success', next: null };
function form() { const f = new FormData(); f.set('orderId', 'o1'); f.set('action', 'check'); f.set('sourceHash', 'hash'); return f; }

test('review JSON returns source-check feedback without a Flight response', async () => {
  const calls: string[] = [];
  const actual = await requestOmsReview(form(), async (url, init) => {
    calls.push(String(url)); assert.equal(init?.method, 'POST'); assert.equal(init?.credentials, 'same-origin');
    assert.equal(JSON.parse(String(init?.body)).action, 'check');
    return Response.json(result);
  });
  assert.deepEqual(actual, result);
  assert.deepEqual(calls, ['/api/orders/o1/review']);
});

test('a never-ending review request finishes as uncertain and is never retried', async () => {
  let calls = 0;
  const startedAt = Date.now();
  const actual = await requestOmsReview(form(), async () => { calls++; return new Promise<Response>(() => {}); }, 10);
  assert.equal(actual.ok, false); assert.equal(actual.uncertain, true); assert.equal(actual.action, null);
  assert.equal(calls, 1); assert.ok(Date.now() - startedAt < 500);
});

test('review keeps blocking results and rejects login HTML as uncertain', async () => {
  const blocked = { ...result, ok: false, kind: 'blocked', message: '資料待核對', blockers: ['商品對應不唯一'] };
  assert.deepEqual(await requestOmsReview(form(), async () => Response.json(blocked, { status: 409 })), blocked);
  const lost = await requestOmsReview(form(), async () => new Response('<html>登入</html>', { headers: { 'content-type': 'text/html' } }));
  assert.equal(lost.uncertain, true);
});

function route(authenticated = true) {
  const writes: FormData[] = [];
  const output = ts.transpileModule(readFileSync('app/api/orders/[id]/review/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded: Record<string, Function> = {};
  new Function('require', 'exports', output)((name: string) => {
    if (name === '@/lib/auth') return { getCurrentUser: async () => authenticated ? { userId: 'hq' } : null };
    if (name === '@/lib/orders/review-service') return { emptyReviewResult: (v = {}) => ({ ...result, ...v }) };
    if (name === '@/app/(main)/orders/oms-actions') return { omsReviewAction: async (_previous: unknown, f: FormData) => { writes.push(f); return result; } };
    throw new Error(name);
  }, loaded);
  return { loaded, writes };
}
const context = () => ({ params: Promise.resolve({ id: 'o1' }) });
const request = (origin = 'https://hq.example') => new Request('https://hq.example/api/orders/o1/review', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' },
  body: JSON.stringify({ orderId: 'wrong-order', action: 'check', sourceHash: 'hash', pendingShipmentReview: '1' }),
});

test('review API enforces HQ login and same-origin before the gated action', async () => {
  const anonymous = route(false);
  assert.equal((await anonymous.loaded.POST(request(), context())).status, 401);
  assert.equal(anonymous.writes.length, 0);
  const signedIn = route();
  assert.equal((await signedIn.loaded.POST(request('https://attacker.example'), context())).status, 403);
  assert.equal(signedIn.writes.length, 0);
});

test('review API preserves the existing review gate and route order identity', async () => {
  const { loaded, writes } = route();
  const response = await loaded.POST(request(), context());
  assert.deepEqual(await response.json(), result);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(writes[0].get('orderId'), 'o1');
  assert.equal(writes[0].get('pendingShipmentReview'), '1');
});
