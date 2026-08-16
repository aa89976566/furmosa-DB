import assert from 'node:assert/strict';
import { createHmac, scryptSync } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  createSessionCookieValue,
  evaluateLoginAttempt,
  evaluateLogout,
  evaluatePageAccess,
  GROOMING_PREVIEW_AUD,
  GROOMING_PREVIEW_COOKIE_MAX_AGE_SEC,
  GROOMING_PREVIEW_COOKIE_NAME,
  GROOMING_PREVIEW_COOKIE_OPTIONS,
  GROOMING_PREVIEW_PATH,
  isPreviewRouteAvailable,
  isSameOriginPost,
  resolvePostRedirect,
  SCRYPT_ENCODED_PREFIX,
  verifySessionCookieValue,
  type PreviewAuthEnv,
} from '../preview-auth-core';

const TEST_PASSWORD = 'preview-test-password';
const TEST_SALT = Buffer.from('preview-test-salt16');
const TEST_SCRYPT = `${SCRYPT_ENCODED_PREFIX}${TEST_SALT.toString('base64url')}$${scryptSync(
  TEST_PASSWORD,
  TEST_SALT,
  32,
  { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
).toString('base64url')}`;
const VALID_COOKIE_SECRET = Buffer.alloc(32, 9).toString('base64url');
const NOW_MS = Date.parse('2026-08-16T08:00:00.000Z');

function fakeAuthEnv(overrides: Partial<PreviewAuthEnv> = {}): PreviewAuthEnv {
  return {
    VERCEL_ENV: 'preview',
    GROOMING_PREVIEW_AUTH_ENABLED: 'true',
    GROOMING_PREVIEW_BRANCH: 'cursor/grooming-voucher-preview-login-49d3',
    VERCEL_GIT_COMMIT_REF: 'cursor/grooming-voucher-preview-login-49d3',
    VERCEL_GIT_COMMIT_SHA: '552a7054cafcc772c1f05edd34db769ca361f3c9',
    GROOMING_PREVIEW_USERNAME: 'preview-test-user',
    GROOMING_PREVIEW_PASSWORD_SCRYPT: TEST_SCRYPT,
    GROOMING_PREVIEW_COOKIE_SECRET: VALID_COOKIE_SECRET,
    ...overrides,
  };
}

function sameOriginHeaders(
  extras: Record<string, string | null> = {},
): (name: string) => string | null {
  const headers: Record<string, string | null> = {
    host: 'furmosa-preview.vercel.app',
    'x-forwarded-proto': 'https',
    origin: 'https://furmosa-preview.vercel.app',
    ...extras,
  };
  return (name) => (name in headers ? headers[name] : null);
}

describe('grooming preview server auth', () => {
  it('production and closed env fail closed as 404', () => {
    assert.equal(evaluatePageAccess({
      env: fakeAuthEnv({ VERCEL_ENV: 'production' }),
      cookieValue: undefined,
      nowMs: NOW_MS,
    }), 'not_found');
    assert.equal(isPreviewRouteAvailable(fakeAuthEnv({ VERCEL_ENV: 'development' })), false);
  });

  it('disabled or missing env fail closed', () => {
    assert.equal(
      evaluatePageAccess({
        env: fakeAuthEnv({ GROOMING_PREVIEW_AUTH_ENABLED: undefined }),
        cookieValue: undefined,
        nowMs: NOW_MS,
      }),
      'not_found',
    );
    assert.equal(
      evaluatePageAccess({
        env: fakeAuthEnv({ GROOMING_PREVIEW_USERNAME: undefined }),
        cookieValue: undefined,
        nowMs: NOW_MS,
      }),
      'not_found',
    );
    assert.equal(
      evaluatePageAccess({
        env: fakeAuthEnv({ GROOMING_PREVIEW_PASSWORD_SCRYPT: undefined }),
        cookieValue: undefined,
        nowMs: NOW_MS,
      }),
      'not_found',
    );
    assert.equal(
      evaluatePageAccess({
        env: fakeAuthEnv({ GROOMING_PREVIEW_COOKIE_SECRET: undefined }),
        cookieValue: undefined,
        nowMs: NOW_MS,
      }),
      'not_found',
    );
  });

  it('invalid cookie secret formats fail closed', () => {
    const rejected = [
      '',
      'A',
      Buffer.alloc(31, 9).toString('base64url'),
      Buffer.alloc(33, 9).toString('base64url'),
      `${VALID_COOKIE_SECRET}=`,
      Buffer.alloc(32, 9).toString('base64'),
    ];
    for (const secret of rejected) {
      const env = fakeAuthEnv({ GROOMING_PREVIEW_COOKIE_SECRET: secret });
      assert.equal(isPreviewRouteAvailable(env), false, secret);
      assert.equal(createSessionCookieValue(env, NOW_MS), null, secret);
      assert.equal(
        evaluatePageAccess({ env, cookieValue: 'x.y', nowMs: NOW_MS }),
        'not_found',
        secret,
      );
    }
  });

  it('HMAC signs and verifies with decoded secret bytes, not the raw string', () => {
    const env = fakeAuthEnv();
    const value = createSessionCookieValue(env, NOW_MS);
    assert.ok(value);
    const body = value.split('.')[0];
    const actualSig = value.split('.')[1];
    const stringKeySig = createHmac('sha256', VALID_COOKIE_SECRET).update(body).digest('base64url');
    const byteKeySig = createHmac('sha256', Buffer.from(VALID_COOKIE_SECRET, 'base64url'))
      .update(body)
      .digest('base64url');
    assert.equal(actualSig, byteKeySig);
    assert.notEqual(actualSig, stringKeySig);
    assert.equal(verifySessionCookieValue(value, env, NOW_MS), true);
  });

  it('branch mismatch is 404 even with a minted cookie', () => {
    const env = fakeAuthEnv();
    const cookie = createSessionCookieValue(env, NOW_MS);
    assert.ok(cookie);
    assert.equal(
      evaluatePageAccess({
        env: fakeAuthEnv({ VERCEL_GIT_COMMIT_REF: 'other-branch' }),
        cookieValue: cookie,
        nowMs: NOW_MS,
      }),
      'not_found',
    );
  });

  it('wrong credentials reject without a cookie', async () => {
    const env = fakeAuthEnv();
    const wrongUser = await evaluateLoginAttempt({
      env,
      username: 'not-the-user',
      password: TEST_PASSWORD,
      headerGet: sameOriginHeaders(),
      nowMs: NOW_MS,
    });
    const wrongPass = await evaluateLoginAttempt({
      env,
      username: 'preview-test-user',
      password: 'wrong-password',
      headerGet: sameOriginHeaders(),
      nowMs: NOW_MS,
    });
    assert.equal(wrongUser.type, 'reject');
    assert.equal(wrongPass.type, 'reject');
    assert.equal('cookie' in wrongUser, false);
    assert.equal('cookie' in wrongPass, false);
  });

  it('correct credentials set HttpOnly Secure Lax path-scoped 2h cookie', async () => {
    const decision = await evaluateLoginAttempt({
      env: fakeAuthEnv(),
      username: 'preview-test-user',
      password: TEST_PASSWORD,
      headerGet: sameOriginHeaders(),
      nowMs: NOW_MS,
    });
    assert.equal(decision.type, 'ok');
    if (decision.type !== 'ok') return;
    assert.equal(decision.cookie.name, GROOMING_PREVIEW_COOKIE_NAME);
    assert.equal(decision.redirectTo, GROOMING_PREVIEW_PATH);
    assert.deepEqual(decision.cookie.options, GROOMING_PREVIEW_COOKIE_OPTIONS);
    assert.equal(decision.cookie.options.httpOnly, true);
    assert.equal(decision.cookie.options.secure, true);
    assert.equal(decision.cookie.options.sameSite, 'lax');
    assert.equal(decision.cookie.options.path, GROOMING_PREVIEW_PATH);
    assert.equal(decision.cookie.options.maxAge, GROOMING_PREVIEW_COOKIE_MAX_AGE_SEC);
    assert.equal(decision.cookie.options.maxAge, 7200);
    assert.equal(
      evaluatePageAccess({
        env: fakeAuthEnv(),
        cookieValue: decision.cookie.value,
        nowMs: NOW_MS,
      }),
      'app',
    );
  });

  it('expired, tampered, and different SHA cookies never show the app', () => {
    const env = fakeAuthEnv();
    const valid = createSessionCookieValue(env, NOW_MS);
    assert.ok(valid);

    const expired = createSessionCookieValue(env, NOW_MS - (3 * 60 * 60 * 1000));
    assert.ok(expired);
    assert.equal(verifySessionCookieValue(expired, env, NOW_MS), false);
    assert.equal(evaluatePageAccess({ env, cookieValue: expired, nowMs: NOW_MS }), 'login');

    const tampered = `${valid.slice(0, 8)}x${valid.slice(9)}`;
    assert.equal(verifySessionCookieValue(tampered, env, NOW_MS), false);
    assert.equal(evaluatePageAccess({ env, cookieValue: tampered, nowMs: NOW_MS }), 'login');

    const otherSha = createSessionCookieValue(
      fakeAuthEnv({ VERCEL_GIT_COMMIT_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
      NOW_MS,
    );
    assert.ok(otherSha);
    assert.equal(verifySessionCookieValue(otherSha, env, NOW_MS), false);
    assert.equal(evaluatePageAccess({ env, cookieValue: otherSha, nowMs: NOW_MS }), 'login');
    assert.notEqual(evaluatePageAccess({ env, cookieValue: otherSha, nowMs: NOW_MS }), 'app');
  });

  it('cookie payload binds aud, exp, and commit SHA', () => {
    const value = createSessionCookieValue(fakeAuthEnv(), NOW_MS);
    assert.ok(value);
    const body = value.split('.')[0];
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      aud: string;
      exp: number;
      sha: string;
    };
    assert.equal(payload.aud, GROOMING_PREVIEW_AUD);
    assert.equal(payload.exp, Math.floor(NOW_MS / 1000) + GROOMING_PREVIEW_COOKIE_MAX_AGE_SEC);
    assert.equal(payload.sha, '552a7054cafcc772c1f05edd34db769ca361f3c9');
  });

  it('same-origin is required; missing or cross-origin POST is rejected', async () => {
    assert.equal(isSameOriginPost(sameOriginHeaders()), true);
    assert.equal(
      isSameOriginPost(sameOriginHeaders({ origin: 'https://evil.example' })),
      false,
    );
    assert.equal(isSameOriginPost(sameOriginHeaders({ origin: null, referer: null })), false);
    assert.equal(
      isSameOriginPost(
        sameOriginHeaders({
          origin: null,
          referer: 'https://furmosa-preview.vercel.app/preview/grooming-voucher',
        }),
      ),
      true,
    );

    const crossOrigin = await evaluateLoginAttempt({
      env: fakeAuthEnv(),
      username: 'preview-test-user',
      password: TEST_PASSWORD,
      headerGet: sameOriginHeaders({ origin: 'https://evil.example' }),
      nowMs: NOW_MS,
    });
    assert.equal(crossOrigin.type, 'reject');
    assert.equal('cookie' in crossOrigin, false);
  });

  it('never follows returnUrl or other open redirects', async () => {
    assert.equal(resolvePostRedirect('https://evil.example'), GROOMING_PREVIEW_PATH);
    assert.equal(resolvePostRedirect('/dashboard'), GROOMING_PREVIEW_PATH);
    assert.equal(resolvePostRedirect('//evil.example'), GROOMING_PREVIEW_PATH);
    assert.equal(resolvePostRedirect('/preview/grooming-voucher/extra'), GROOMING_PREVIEW_PATH);

    const decision = await evaluateLoginAttempt({
      env: fakeAuthEnv(),
      username: 'preview-test-user',
      password: TEST_PASSWORD,
      headerGet: sameOriginHeaders(),
      nowMs: NOW_MS,
    });
    assert.equal(decision.type, 'ok');
    if (decision.type === 'ok') {
      assert.equal(decision.redirectTo, GROOMING_PREVIEW_PATH);
    }
  });

  it('logout clears the path-scoped cookie', () => {
    const decision = evaluateLogout({ headerGet: sameOriginHeaders() });
    assert.equal(decision.type, 'ok');
    if (decision.type !== 'ok') return;
    assert.equal(decision.cookie.name, GROOMING_PREVIEW_COOKIE_NAME);
    assert.equal(decision.cookie.value, '');
    assert.equal(decision.cookie.options.maxAge, 0);
    assert.equal(decision.cookie.options.path, GROOMING_PREVIEW_PATH);
    assert.equal(decision.cookie.options.httpOnly, true);
    assert.equal(decision.redirectTo, GROOMING_PREVIEW_PATH);
  });

  it('logout without same-origin does not clear the cookie', () => {
    const decision = evaluateLogout({
      headerGet: sameOriginHeaders({ origin: 'https://evil.example' }),
    });
    assert.equal(decision.type, 'reject');
  });

  it('unauthenticated available route shows login, not the app', () => {
    assert.equal(
      evaluatePageAccess({
        env: fakeAuthEnv(),
        cookieValue: undefined,
        nowMs: NOW_MS,
      }),
      'login',
    );
  });
});
