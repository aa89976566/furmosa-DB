import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BLOCKED_REAL_STORE_MESSAGE,
  FORBIDDEN_ACTOR_MESSAGE,
  LIMITED_TARGET_MESSAGE,
  PREVIEW_READONLY_MESSAGE,
  PRODUCTION_FEATURE_OFF_MESSAGE,
  decideIdentityWrite,
  denyIdentityWrite,
  denyMerchantWrite,
} from '@/lib/jar-exchange/partner-store-identity-write-guard';

describe('limited rollout write guard', () => {
  it('keeps Production writes off by default', () => {
    const decision = decideIdentityWrite('confirm', { VERCEL_ENV: 'production' }, 'hq@example.test');
    assert.equal(decision.allowed, false);
    if (!decision.allowed) {
      assert.equal(decision.reason, 'feature_off');
      assert.equal(decision.error, PRODUCTION_FEATURE_OFF_MESSAGE);
    }
  });

  it('rejects Preview even if the write flag is on', () => {
    const decision = decideIdentityWrite(
      'confirm',
      {
        VERCEL_ENV: 'preview',
        PARTNER_STORE_IDENTITY_WRITES: 'enabled',
        PARTNER_STORE_IDENTITY_WRITERS: 'hq@example.test',
      },
      'hq@example.test',
    );
    assert.equal(decision.allowed, false);
    if (!decision.allowed) {
      assert.equal(decision.error, PREVIEW_READONLY_MESSAGE);
    }
  });

  it('allows only the designated HQ account when Production writes are enabled', () => {
    const env = {
      VERCEL_ENV: 'production',
      PARTNER_STORE_IDENTITY_WRITES: 'enabled',
      PARTNER_STORE_IDENTITY_WRITERS: 'hq@example.test',
    };
    assert.equal(decideIdentityWrite('confirm', env, 'hq@example.test').allowed, true);
    const other = decideIdentityWrite('confirm', env, 'other@example.test');
    assert.equal(other.allowed, false);
    if (!other.allowed) {
      assert.equal(other.error, FORBIDDEN_ACTOR_MESSAGE);
    }
    assert.equal(denyIdentityWrite('revoke', env, 'other@example.test')?.error, FORBIDDEN_ACTOR_MESSAGE);
  });

  it('never allows the five real stores and only allows MER-DEMO in Production', () => {
    const production = { VERCEL_ENV: 'production' };
    assert.equal(denyMerchantWrite('MER-0019', production)?.error, BLOCKED_REAL_STORE_MESSAGE);
    assert.equal(denyMerchantWrite('MER-0020', production)?.error, BLOCKED_REAL_STORE_MESSAGE);
    assert.equal(denyMerchantWrite('MER-0016', production)?.error, BLOCKED_REAL_STORE_MESSAGE);
    assert.equal(denyMerchantWrite('MER-0017', production)?.error, BLOCKED_REAL_STORE_MESSAGE);
    assert.equal(denyMerchantWrite('MER-0010', production)?.error, BLOCKED_REAL_STORE_MESSAGE);
    assert.equal(denyMerchantWrite('MER-0015', production)?.error, LIMITED_TARGET_MESSAGE);
    assert.equal(denyMerchantWrite('MER-DEMO', production), null);
  });
});
