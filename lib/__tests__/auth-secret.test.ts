import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  requiresAuthSecretEnv,
  resolveAuthSecret,
} from '@/lib/auth-secret';

describe('auth-secret (Phase 1 C1)', () => {
  it('requires AUTH_SECRET when NODE_ENV is production', () => {
    assert.equal(requiresAuthSecretEnv('production'), true);
    assert.equal(requiresAuthSecretEnv('development'), false);
    assert.equal(requiresAuthSecretEnv('test'), false);
    assert.equal(requiresAuthSecretEnv(undefined), false);
  });

  it('uses provided AUTH_SECRET when set', () => {
    assert.equal(
      resolveAuthSecret({ AUTH_SECRET: '  my-prod-secret  ', NODE_ENV: 'production' }),
      'my-prod-secret',
    );
  });

  it('throws in production when AUTH_SECRET missing', () => {
    assert.throws(
      () => resolveAuthSecret({ NODE_ENV: 'production' }),
      /缺少環境變數 AUTH_SECRET/,
    );
    assert.throws(
      () => resolveAuthSecret({ AUTH_SECRET: '   ', NODE_ENV: 'production' }),
      /缺少環境變數 AUTH_SECRET/,
    );
  });

  it('allows local fallback outside production', () => {
    const secret = resolveAuthSecret({ NODE_ENV: 'development' });
    assert.ok(secret.length >= 32);
    assert.match(secret, /dev-secret/);
  });

  it('reports configuration without exposing secret', async () => {
    const { isAuthSecretConfigured } = await import('@/lib/auth-secret');
    assert.equal(isAuthSecretConfigured({ AUTH_SECRET: 'x'.repeat(40) }), true);
    assert.equal(isAuthSecretConfigured({ AUTH_SECRET: '   ' }), false);
    assert.equal(isAuthSecretConfigured({}), false);
  });
});
