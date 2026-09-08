import { pathToFileURL } from 'node:url';

// Fixed, audited GET routes only. Never run login actions, cron, coupon reads
// (which expire rows), seed endpoints, or payment/webhook operations.
// Public health is intentionally liveness-only; DB readiness must not be
// reintroduced as an unauthenticated production smoke dependency.
export async function runSmoke({ origin, fetchFn = fetch }) {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('An HTTPS origin without credentials, path, or query is required');
  }
  const checks = [
    { path: '/api/health', kind: 'health', status: 200 },
    { path: '/login', kind: 'hq-login', status: 200 },
    { path: '/pos/login', kind: 'pos-login', status: 200 },
    { path: '/orders', kind: 'redirect', status: 307, destination: '/login' },
    { path: '/pos', kind: 'redirect', status: 307, destination: '/pos/login' },
    { path: '/api/merchant/refill-orders', kind: 'unauthorized', status: 401 },
  ];
  const results = [];
  for (const check of checks) {
    const started = performance.now();
    let ok = false;
    let status = null;
    try {
      const res = await fetchFn(new URL(check.path, base), {
        method: 'GET', redirect: 'manual', cache: 'no-store',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Furmosa-ReadOnly-Smoke/1.0' },
      });
      status = res.status;
      ok = status === check.status;
      if (check.kind === 'redirect') {
        const location = res.headers.get('location');
        const target = location ? new URL(location, base) : null;
        ok &&= target?.origin === base.origin && target.pathname === check.destination;
        await res.body?.cancel();
      } else if (check.kind.endsWith('login')) {
        const body = await res.text();
        ok &&= body.includes(check.kind === 'hq-login' ? 'Furmosa HQ' : 'Furmosa POS') && /type="password"/.test(body);
      } else if (check.kind === 'unauthorized') {
        await res.body?.cancel();
      } else {
        const body = await res.json();
        ok &&= /no-store/.test(res.headers.get('cache-control') ?? '');
        if (check.kind === 'health') ok &&= body.ok === true && body.service === 'furmosa-hq';
      }
    } catch {
      // Do not log exceptions, response bodies, URLs with secrets, or cookies.
      ok = false;
    }
    results.push({ path: check.path, ok, status, latencyMs: Math.round(performance.now() - started) });
  }
  return { ok: results.every((r) => r.ok), coverage: 'public pages and unauthenticated authorization gates; authenticated order/POS reads require separate verification', results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await runSmoke({ origin: process.argv[2] });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  } catch {
    console.error('Smoke configuration invalid');
    process.exitCode = 1;
  }
}
