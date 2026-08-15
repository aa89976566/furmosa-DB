import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { GET } from './route.ts';

const EXPECTED_STATUS = 200;
const EXPECTED_JSON = { ok: true, service: 'furmosa-hq' };
const EXPECTED_BODY = JSON.stringify(EXPECTED_JSON);
const ROUTE_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'route.ts'),
  'utf8',
);

const SENSITIVE_ENV_KEYS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'AUTH_SECRET',
  'JWT_SECRET',
  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'ECPAY_HASH_KEY',
  'ECPAY_HASH_IV',
  'ECPAY_MERCHANT_ID',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
];

const FORBIDDEN_RESPONSE_MARKERS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'AUTH_SECRET',
  'fixHint',
  'merchantUsers',
  'authSecret',
  'pooler',
  'projectref',
  'postgresql://',
  'missing_schema',
  'merchant_users',
  'console.error',
];

function readSensitiveEnvKeysDuring(run: () => Promise<void>): string[] {
  const reads: string[] = [];
  const original = process.env;
  process.env = new Proxy(original, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && SENSITIVE_ENV_KEYS.includes(prop)) {
        reads.push(prop);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return Promise.resolve()
    .then(run)
    .finally(() => {
      process.env = original;
    })
    .then(() => reads);
}

async function assertFixedLiveness(res: Response) {
  assert.equal(res.status, EXPECTED_STATUS);

  const contentType = res.headers.get('content-type') ?? '';
  assert.match(contentType, /application\/json/i);

  const cacheControl = res.headers.get('cache-control') ?? '';
  assert.match(cacheControl, /no-store/i);
  assert.match(cacheControl, /max-age=0/i);
  assert.equal(res.headers.get('pragma'), 'no-cache');

  assert.equal(res.headers.get('set-cookie'), null);
  assert.equal(res.headers.get('location'), null);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.equal(res.headers.get('access-control-allow-credentials'), null);

  const text = await res.text();
  assert.equal(text, EXPECTED_BODY);
  assert.deepEqual(JSON.parse(text), EXPECTED_JSON);
  assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}T/);
  assert.doesNotMatch(text, /[0-9a-f]{40}/i);

  const headerBlob = [...res.headers.entries()].flat().join('\n');
  const haystack = `${text}\n${headerBlob}`;
  for (const marker of FORBIDDEN_RESPONSE_MARKERS) {
    assert.equal(haystack.includes(marker), false, `response leaked marker: ${marker}`);
  }
}

describe('GET /api/health is public liveness only', () => {
  it('returns the fixed 200 JSON and cache headers', async () => {
    const res = await GET();
    await assertFixedLiveness(res);
  });

  it('does not set cookies, redirects, or CORS', async () => {
    const res = await GET();
    await assertFixedLiveness(res);
  });

  it('production route source has no prisma, auth-secret, env, or logging', () => {
    assert.doesNotMatch(ROUTE_SOURCE, /@prisma\/client|@\/lib\/prisma|PrismaClient/);
    assert.doesNotMatch(ROUTE_SOURCE, /auth-secret|isAuthSecretConfigured/);
    assert.doesNotMatch(ROUTE_SOURCE, /process\.env/);
    assert.doesNotMatch(ROUTE_SOURCE, /console\.(log|error|info|warn|debug)/);
    assert.doesNotMatch(ROUTE_SOURCE, /summarizeError|urlShape|probeUrl|fixHint/);
  });

  it('handler does not read sensitive process.env keys', async () => {
    const reads = await readSensitiveEnvKeysDuring(async () => {
      const res = await GET();
      await assertFixedLiveness(res);
    });
    assert.deepEqual(reads, []);
  });
});
