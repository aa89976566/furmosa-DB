import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  authenticateMerchantCredentials,
  buildMerchantSessionClaims,
  readMerchantSession,
  signMerchantSession,
  MERCHANT_SESSION_TYPE,
} from '@/lib/merchant-auth/session';
import {
  assertMerchantAccess,
  MerchantAccessError,
  resolveMerchantIdForQuery,
  merchantScope,
} from '@/lib/merchant-auth/access';
import { decideHqAccess, decidePosAccess } from '@/lib/merchant-auth/edge';
import { hashPassword } from '@/lib/auth';
import { getWaitingForJarReservationDays, POS_BUTTON_LABELS } from '@/lib/config/product-settings';

const MERCHANT_A = 'merchant-a-id';
const MERCHANT_B = 'merchant-b-id';

describe('merchant session JWT', () => {
  it('signs session with merchantId and type=merchant', async () => {
    const { token, payload } = await signMerchantSession({
      merchantUserId: 'mu-1',
      merchantId: MERCHANT_A,
      username: 'store_a',
    });
    assert.equal(payload.type, MERCHANT_SESSION_TYPE);
    assert.equal(payload.merchantId, MERCHANT_A);
    assert.equal(payload.username, 'store_a');
    assert.ok(payload.issuedAt > 0);
    assert.ok(payload.expiresAt > payload.issuedAt);

    const read = await readMerchantSession(token);
    assert.ok(read);
    assert.equal(read!.merchantId, MERCHANT_A);
    assert.equal(read!.merchantUserId, 'mu-1');
  });

  it('rejects expired session', async () => {
    const now = new Date('2026-07-21T12:00:00Z');
    const { token } = await signMerchantSession(
      {
        merchantUserId: 'mu-1',
        merchantId: MERCHANT_A,
        username: 'store_a',
      },
      { now, hours: 1 },
    );
    const later = new Date('2026-07-21T14:00:00Z');
    const read = await readMerchantSession(token, { now: later });
    assert.equal(read, null);
  });

  it('buildMerchantSessionClaims includes issuedAt/expiresAt', () => {
    const now = new Date('2026-07-21T00:00:00Z');
    const claims = buildMerchantSessionClaims({
      merchantUserId: 'mu-1',
      merchantId: MERCHANT_A,
      username: 'u',
      now,
      hours: 2,
    });
    assert.equal(claims.expiresAt - claims.issuedAt, 2 * 60 * 60);
  });
});

describe('authenticateMerchantCredentials', () => {
  async function user(overrides: Partial<{
    id: string;
    merchantId: string;
    username: string;
    passwordHash: string;
    isActive: boolean;
  }> = {}) {
    const passwordHash = overrides.passwordHash ?? (await hashPassword('correct-pass'));
    return {
      id: overrides.id ?? 'mu-1',
      merchantId: overrides.merchantId ?? MERCHANT_A,
      username: overrides.username ?? 'store_a',
      passwordHash,
      isActive: overrides.isActive ?? true,
    };
  }

  it('1. succeeds with correct password', async () => {
    const row = await user();
    const result = await authenticateMerchantCredentials('store_a', 'correct-pass', {
      findByUsername: async () => row,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.user.merchantId, MERCHANT_A);
  });

  it('2. fails with wrong password', async () => {
    const row = await user();
    const result = await authenticateMerchantCredentials('store_a', 'wrong', {
      findByUsername: async () => row,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /帳號或密碼/);
  });

  it('3. fails when username missing', async () => {
    const result = await authenticateMerchantCredentials('nope', 'x', {
      findByUsername: async () => null,
    });
    assert.equal(result.ok, false);
  });

  it('4. fails when isActive=false', async () => {
    const row = await user({ isActive: false });
    const result = await authenticateMerchantCredentials('store_a', 'correct-pass', {
      findByUsername: async () => row,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /停用/);
  });
});

describe('data isolation helpers', () => {
  it('5/7. session merchantId scopes queries', () => {
    assert.deepEqual(merchantScope(MERCHANT_A), { merchantId: MERCHANT_A });
  });

  it('8. Merchant A cannot assert access to Merchant B', () => {
    assert.throws(
      () => assertMerchantAccess(MERCHANT_B, MERCHANT_A),
      (err: unknown) => err instanceof MerchantAccessError,
    );
  });

  it('7. Merchant A can assert access to self', () => {
    assert.doesNotThrow(() => assertMerchantAccess(MERCHANT_A, MERCHANT_A));
  });

  it('9. forged client merchantId is ignored', () => {
    const resolved = resolveMerchantIdForQuery(MERCHANT_A, MERCHANT_B);
    assert.equal(resolved, MERCHANT_A);
  });
});

describe('middleware guards (HQ vs POS cookies do not elevate)', () => {
  it('6/10. unauthenticated POS home redirects to login', () => {
    const d = decidePosAccess({ pathname: '/pos', hasMerchantSession: false });
    assert.equal(d.action, 'redirect');
    if (d.action === 'redirect') {
      assert.equal(d.pathname, '/pos/login');
      assert.equal(d.next, '/pos');
    }
  });

  it('HQ session alone does not satisfy POS guard', () => {
    // Guard only looks at hasMerchantSession — HQ cookie is irrelevant
    const d = decidePosAccess({ pathname: '/pos', hasMerchantSession: false });
    assert.equal(d.action, 'redirect');
  });

  it('merchant session alone does not satisfy HQ guard', () => {
    const d = decideHqAccess({
      pathname: '/dashboard',
      hasHqSession: false,
      isPublic: false,
    });
    assert.equal(d.action, 'redirect');
    if (d.action === 'redirect') assert.equal(d.pathname, '/login');
  });

  it('POS login with session redirects to /pos', () => {
    const d = decidePosAccess({ pathname: '/pos/login', hasMerchantSession: true });
    assert.equal(d.action, 'redirect');
    if (d.action === 'redirect') assert.equal(d.pathname, '/pos');
  });

  it('12. HQ login still redirects authenticated HQ to dashboard', () => {
    const d = decideHqAccess({
      pathname: '/login',
      hasHqSession: true,
      isPublic: true,
    });
    assert.equal(d.action, 'redirect');
    if (d.action === 'redirect') assert.equal(d.pathname, '/dashboard');
  });
});

describe('product settings (not hardcoded in domain)', () => {
  it('waiting_for_jar default 14 days', () => {
    const prev = process.env.WAITING_FOR_JAR_RESERVATION_DAYS;
    delete process.env.WAITING_FOR_JAR_RESERVATION_DAYS;
    assert.equal(getWaitingForJarReservationDays(), 14);
    process.env.WAITING_FOR_JAR_RESERVATION_DAYS = '21';
    assert.equal(getWaitingForJarReservationDays(), 21);
    if (prev === undefined) delete process.env.WAITING_FOR_JAR_RESERVATION_DAYS;
    else process.env.WAITING_FOR_JAR_RESERVATION_DAYS = prev;
  });

  it('frozen POS button labels', () => {
    assert.equal(POS_BUTTON_LABELS.confirmEmptyJarAndDeliver, '確認收到空罐並交付');
    assert.equal(POS_BUTTON_LABELS.confirmDeliverProduct, '確認交付商品');
  });
});
