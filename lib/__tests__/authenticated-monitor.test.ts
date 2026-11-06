import assert from 'node:assert/strict';
import test from 'node:test';

test('authenticated monitor permits only reviewed pages and one scoped login', async () => {
  const { requestDecision } = await import('../../scripts/authenticated-monitor-policy.mjs');
  const base = { origin: 'https://example.invalid', role: 'pos', loginOpen: false, loginUsed: false, actionIds: new Set<string>(), method: 'GET', resourceType: 'document' };
  const decide = (path: string, extra = {}) => requestDecision({ ...base, url: new URL(path, base.origin).href, ...extra });
  assert.equal(decide('/pos/sell'), 'read');
  assert.equal(decide('/orders'), 'deny');
  assert.equal(decide('/api/merchant/coupons'), 'deny'); // GET may expire rows.
  assert.equal(decide('/api/cron/process'), 'deny');
  assert.equal(decide('https://external.invalid/pos/sell'), 'deny');
  assert.equal(decide('/pos/login', { method: 'POST', loginOpen: true }), 'login');
  assert.equal(decide('/pos/login', { method: 'POST', loginOpen: true, loginUsed: true }), 'deny');
  assert.equal(decide('/pos/sell', { method: 'POST', loginOpen: true }), 'deny');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(decide('/pos/settle', { method }), 'deny');
});

test('only named no-argument notification reads pass; acknowledgement and arbitrary action IDs fail closed', async () => {
  const { collectReadActionIds, requestDecision } = await import('../../scripts/authenticated-monitor-policy.mjs');
  const safe = 'a'.repeat(42);
  const unsafe = 'b'.repeat(42);
  const source = `(0,n.createServerReference)("${safe}",n.callServer,void 0,n.findSourceMapURL,"loadUnreadNotifications");(0,n.createServerReference)("${unsafe}",n.callServer,void 0,n.findSourceMapURL,"readMerchantNotification")`;
  const actionIds = collectReadActionIds(source);
  assert.deepEqual([...actionIds], [safe]);
  assert.equal(collectReadActionIds('new unsupported bundle syntax').size, 0);
  const request = { origin: 'https://example.invalid', url: 'https://example.invalid/pos/stock', role: 'pos', method: 'POST', resourceType: 'fetch', actionIds, body: '[]', headers: { 'next-action': safe } };
  assert.equal(requestDecision(request), 'read-action');
  assert.equal(requestDecision({ ...request, body: '["record-id"]' }), 'deny');
  assert.equal(requestDecision({ ...request, headers: { 'next-action': unsafe } }), 'deny');
  assert.equal(requestDecision({ ...request, role: 'hq' }), 'deny');
  assert.equal(requestDecision({ ...request, url: 'https://example.invalid/api/merchant/coupons' }), 'deny');
});

test('missing credentials cannot launch a browser or report success, and errors contain no supplied secrets', async () => {
  const { runAuthenticatedMonitor } = await import('../../scripts/authenticated-production-monitor.mjs');
  const report = await runAuthenticatedMonitor({ chromium: { launch() { assert.fail('must not launch'); } }, credentials: { hqPassword: 'SENSITIVE_TEST_VALUE' } });
  assert.equal(report.ok, false);
  assert.equal(report.results[0].code, 'MONITOR_CREDENTIALS_MISSING');
  assert.equal(JSON.stringify(report).includes('SENSITIVE_TEST_VALUE'), false);
  await assert.rejects(runAuthenticatedMonitor({ chromium: {}, credentials: {}, origin: 'https://example.invalid' }), /INVALID_TARGET/);
});

test('a pending route rejected during close cannot escape or expose its exception', async () => {
  const { createRouteBoundary } = await import('../../scripts/authenticated-monitor-routes.mjs');
  let rejectFetch!: (error: Error) => void;
  const fetchPending = new Promise<void>((_, reject) => { rejectFetch = reject; });
  let failures = 0;
  const boundary = createRouteBoundary(async () => fetchPending, () => { failures += 1; });
  const running = boundary.handle({ abort: async () => { throw new Error('context already closed'); } });
  rejectFetch(new Error('TargetClosedError: cookie=SENSITIVE_SESSION_VALUE'));
  await boundary.settle();
  await assert.doesNotReject(running);
  assert.equal(failures, 1);
});

test('runner returns a sanitized failed report when context close cancels an in-flight bundle', async () => {
  const { runAuthenticatedMonitor } = await import('../../scripts/authenticated-production-monitor.mjs');
  const requests: Promise<unknown>[] = [];
  const chromium = { async launch() {
    return {
      async newContext() {
        let handler: (route: unknown) => Promise<unknown>;
        let closed!: () => void;
        const closeSignal = new Promise<void>(resolve => { closed = resolve; });
        const page = {
          setDefaultTimeout() {}, setDefaultNavigationTimeout() {},
          async goto() {
            requests.push(handler({
              request: () => ({
                url: () => 'https://furmosa-hq-production.up.railway.app/_next/static/chunks/pending.js',
                method: () => 'GET', resourceType: () => 'script',
                headers: () => ({}), postData: () => null,
              }),
              fetch: async () => { await closeSignal; throw new Error('cookie=SENSITIVE_SESSION_VALUE'); },
              abort: async () => { throw new Error('already closed'); },
            }));
          },
          getByLabel() { return { async fill() { throw new Error('SENSITIVE_PASSWORD_VALUE'); } }; },
        };
        return {
          async route(_pattern: string, callback: typeof handler) { handler = callback; },
          async newPage() { return page; },
          async close() { closed(); },
        };
      },
      async close() {},
    };
  }};
  const report = await runAuthenticatedMonitor({ chromium, credentials: {
    hqUser: 'fixture-hq', hqPassword: 'fixture-password',
    posUser: 'fixture-pos', posPassword: 'fixture-password',
  }});
  assert.equal(report.ok, false);
  assert.equal(report.results.filter(result => result.code === 'UNREVIEWED_REQUEST_BLOCKED').length, 2);
  assert.equal(JSON.stringify(report).includes('SENSITIVE_'), false);
  assert.ok((await Promise.allSettled(requests)).every(result => result.status === 'fulfilled'));
});
