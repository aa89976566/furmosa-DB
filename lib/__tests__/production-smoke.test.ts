import assert from 'node:assert/strict';
import test from 'node:test';

test('smoke uses only audited GET routes, never follows redirects or sends sessions', async () => {
  const { runSmoke } = await import('../../scripts/production-smoke.mjs');
  const paths: string[] = [];
  const report = await runSmoke({ origin: 'https://example.invalid', fetchFn: async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'manual');
    assert.equal(new Headers(init.headers).has('cookie'), false);
    paths.push(url.pathname);
    const headers = { 'cache-control': 'no-store' };
    if (url.pathname === '/api/health') return Response.json({ ok: true, service: 'furmosa-hq' }, { headers });
    if (url.pathname === '/login') return new Response('Furmosa HQ <input type="password">');
    if (url.pathname === '/pos/login') return new Response('Furmosa POS <input type="password">');
    if (url.pathname === '/orders') return new Response(null, { status: 307, headers: { location: '/login' } });
    if (url.pathname === '/pos') return new Response(null, { status: 307, headers: { location: '/pos/login' } });
    return new Response(null, { status: 401 });
  } });
  assert.equal(report.ok, true);
  assert.deepEqual(paths, ['/api/health', '/login', '/pos/login', '/orders', '/pos', '/api/merchant/refill-orders']);
  assert.equal(paths.includes('/api/health/live'), false);
  assert.equal(paths.includes('/api/health/ready'), false);
});

test('smoke fails closed for redirects, failures, and secret-bearing origins', async () => {
  const { runSmoke } = await import('../../scripts/production-smoke.mjs');
  for (const origin of ['http://example.invalid', 'https://user:secret@example.invalid', 'https://example.invalid/?secret=x']) {
    await assert.rejects(runSmoke({ origin, fetchFn: async () => { assert.fail('must not fetch'); } }));
  }
  const report = await runSmoke({ origin: 'https://example.invalid', fetchFn: async () => new Response(null, { status: 302, headers: { location: 'https://other.invalid/login' } }) });
  assert.equal(report.ok, false);
  const failure = await runSmoke({ origin: 'https://example.invalid', fetchFn: async () => { throw new Error('secret-value'); } });
  assert.equal(failure.ok, false);
  assert.equal(JSON.stringify(failure).includes('secret-value'), false);
});
