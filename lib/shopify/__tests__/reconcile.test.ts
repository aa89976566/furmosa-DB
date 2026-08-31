import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fetchRecentOrders, reconcileLimit, reconcileRecentOrders } from '../reconcile';
import { shopifySnapshot } from '../intake-policy';

const raw = { id: '123', name: '#123', financial_status: 'pending', updated_at: '2026-08-30T00:00:00Z', line_items: [{ title: '未知商品', quantity: 1 }] };
const snapshot = shopifySnapshot(raw);
function harness() {
  const calls = { fetch: 0, persist: 0, audit: 0 };
  const deps = {
    authorize: async () => true,
    fetch: async () => { calls.fetch++; return [snapshot]; }, domain: 'test.myshopify.com',
    existing: async (_id: string): Promise<{ omsStatus: string | null; snapshot: unknown } | null> => null,
    persist: async (event: any) => { calls.persist++; assert.equal(event.origin, 'reconcile'); return { created: true, disposition: 'saved' }; },
    audit: async (_id: string, _status: string, _meta: Record<string, unknown>) => { calls.audit++; },
  };
  return { deps, calls };
}
describe('Shopify manual reconcile', () => {
  it('bounds N and prevents unauthorized reads/writes', async () => {
    for (const n of [0, 26, 1.5, NaN, '', '1x']) assert.throws(() => reconcileLimit(n));
    assert.equal(reconcileLimit('25'), 25);
    const h = harness(); h.deps.authorize = async () => false;
    await assert.rejects(reconcileRecentOrders({ actorId: 'staff', mode: 'sync', limit: 10 }, h.deps), /管理員/);
    assert.deepEqual(h.calls, { fetch: 0, persist: 0, audit: 0 });
  });
  it('inspect reports missing/matched/legacy without any write', async () => {
    const h = harness();
    const run = () => reconcileRecentOrders({ actorId: 'admin', mode: 'inspect', limit: 10 }, h.deps);
    assert.equal((await run()).rows[0].outcome, 'missing');
    h.deps.existing = async () => ({ omsStatus: 'NEW', snapshot });
    assert.equal((await run()).rows[0].outcome, 'matched');
    h.deps.existing = async () => ({ omsStatus: null, snapshot });
    assert.equal((await run()).rows[0].outcome, 'legacy');
    assert.equal(h.calls.persist, 0); assert.equal(h.calls.audit, 0);
  });
  it('sync includes unpaid/unknown SKU, audits and calls shared intake', async () => {
    const h = harness(); const report = await reconcileRecentOrders({ actorId: 'admin', mode: 'sync', limit: 10 }, h.deps);
    assert.equal(report.rows[0].outcome, 'created'); assert.equal(report.auditRecorded, true);
    assert.equal(h.calls.persist, 1); assert.equal(h.calls.audit, 2);
  });
  it('does not mutate orders when initial audit fails and reports later failures honestly', async () => {
    const h = harness(); h.deps.audit = async () => { throw Error('PRIVATE'); };
    await assert.rejects(reconcileRecentOrders({ actorId: 'admin', mode: 'sync', limit: 10 }, h.deps), /未開始/);
    assert.equal(h.calls.persist, 0);
    const p = harness(); p.deps.persist = async () => { throw Error('PRIVATE'); };
    const result = await reconcileRecentOrders({ actorId: 'admin', mode: 'sync', limit: 10 }, p.deps);
    assert.equal(result.complete, false); assert.equal(result.rows[0].outcome, 'failed');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
  });
  it('stops at a time budget and does not claim full completion', async () => {
    const h = harness(); let ticks = 0;
    const result = await reconcileRecentOrders({ actorId: 'admin', mode: 'sync', limit: 10 }, { ...h.deps, now: () => ticks++ * 21000 });
    assert.equal(result.complete, false); assert.equal(result.processed, 0); assert.equal(h.calls.persist, 0);
  });
  it('only reads the configured Shopify host with all statuses and no redirects', async () => {
    const result = await fetchRecentOrders({ domain: 'test.myshopify.com', token: 'TEST_TOKEN' }, 10, async (input, init) => {
      const url = new URL(String(input)); assert.equal(url.host, 'test.myshopify.com');
      assert.equal(url.searchParams.get('status'), 'any'); assert.equal(url.searchParams.get('limit'), '10');
      assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store');
      assert.ok(init?.signal); assert.equal(url.searchParams.has('financial_status'), false);
      return Response.json({ orders: [raw] });
    });
    assert.equal(result[0].order.financial_status, 'pending');
    await assert.rejects(fetchRecentOrders({ domain: 'test.myshopify.com.evil.test', token: 'TEST' }, 10), /尚未設定/);
  });
  it('fails closed on API errors, malformed IDs and duplicate batches', async () => {
    for (const status of [401, 403, 429, 500]) await assert.rejects(fetchRecentOrders({ domain: 'test.myshopify.com', token: 'TEST' }, 10,
      async () => new Response('PRIVATE_TOKEN_RESPONSE', { status })), error => !String(error).includes('PRIVATE_TOKEN_RESPONSE'));
    for (const orders of [[{ id: 9007199254740992 }], [raw, raw], null]) await assert.rejects(fetchRecentOrders({ domain: 'test.myshopify.com', token: 'TEST' }, 10,
      async () => Response.json({ orders })), /回傳資料不完整/);
  });
  it('keeps mutations behind Next server action, admin role and disabled-by-default test gate', () => {
    const action = readFileSync('app/(main)/orders/reconcile-actions.ts', 'utf8');
    assert.match(action, /'use server'/); assert.match(action, /getCurrentUser/);
    assert.match(action, /SHOPIFY_RECONCILE_TEST_MODE !== 'true'/); assert.match(action, /VERCEL_ENV === 'production'/);
    assert.match(action, /role === 'admin'/);
    const form = readFileSync('components/orders/shopify-reconcile-form.tsx', 'utf8');
    assert.doesNotMatch(form, /process\.env|SHOPIFY_ADMIN_ACCESS_TOKEN/);
  });
});
