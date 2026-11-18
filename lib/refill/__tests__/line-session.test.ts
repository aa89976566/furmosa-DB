import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  createRefillLineSession,
  readRefillLineSession,
  REFILL_LINE_SESSION_TTL_SECONDS,
  refillLineSessionCookieOptions,
} from '@/lib/refill/line-session';

const NOW = new Date('2026-11-18T00:00:00.000Z');

test('reuses a short-lived session only for the same LINE ID token', async () => {
  const session = await createRefillLineSession('line-token-a', 'U123', NOW);

  assert.equal(await readRefillLineSession(session, 'line-token-a', NOW), 'U123');
  assert.equal(await readRefillLineSession(session, 'line-token-b', NOW), null);
});

test('expires the LINE refill session after ten minutes', async () => {
  const session = await createRefillLineSession('line-token-a', 'U123', NOW);
  const expired = new Date(
    NOW.getTime() + (REFILL_LINE_SESSION_TTL_SECONDS + 1) * 1000,
  );

  assert.equal(await readRefillLineSession(session, 'line-token-a', expired), null);
});

test('stores only a token fingerprint in the signed session', async () => {
  const rawToken = 'sensitive-line-id-token';
  const session = await createRefillLineSession(rawToken, 'U123', NOW);
  const payload = Buffer.from(session.split('.')[1], 'base64url').toString('utf8');

  assert.doesNotMatch(payload, /sensitive-line-id-token/);
  assert.match(payload, /tokenFingerprint/);
});

test('uses a browser-inaccessible, refill-scoped cookie', () => {
  const options = refillLineSessionCookieOptions();

  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/api/refill');
  assert.equal(options.maxAge, 600);
});

test('rejects malformed sessions without throwing', async () => {
  assert.equal(await readRefillLineSession('not-a-jwt', 'line-token-a', NOW), null);
});

test('registration primes the refill session for the immediate redirect', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/api/line/liff/register/route.ts'),
    'utf8',
  );

  assert.match(source, /createRefillLineSession\(idToken, result\.lineUserId\)/);
  assert.match(source, /response\.cookies\.set\(/);
});
