import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  authorizeCronRequest,
  requiresCronSecretEnv,
} from '@/lib/cron-auth';

describe('requiresCronSecretEnv', () => {
  it('requires on Vercel preview and production', () => {
    assert.equal(requiresCronSecretEnv({ VERCEL_ENV: 'preview' }), true);
    assert.equal(requiresCronSecretEnv({ VERCEL_ENV: 'production' }), true);
  });

  it('requires when NODE_ENV is production', () => {
    assert.equal(requiresCronSecretEnv({ NODE_ENV: 'production' }), true);
  });

  it('does not require for local development / test', () => {
    assert.equal(requiresCronSecretEnv({ NODE_ENV: 'development' }), false);
    assert.equal(requiresCronSecretEnv({ NODE_ENV: 'test' }), false);
    assert.equal(requiresCronSecretEnv({ VERCEL_ENV: 'development' }), false);
  });
});

describe('authorizeCronRequest', () => {
  it('denies production when CRON_SECRET missing', () => {
    const req = new Request('https://example.com/api/cron/x');
    assert.equal(
      authorizeCronRequest(req, { NODE_ENV: 'production' } as NodeJS.ProcessEnv),
      false,
    );
  });

  it('denies Vercel preview when CRON_SECRET missing', () => {
    const req = new Request('https://example.com/api/cron/x');
    assert.equal(
      authorizeCronRequest(req, {
        VERCEL_ENV: 'preview',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
      false,
    );
  });

  it('allows local development without secret', () => {
    const req = new Request('http://localhost:3000/api/cron/x');
    assert.equal(
      authorizeCronRequest(req, { NODE_ENV: 'development' } as NodeJS.ProcessEnv),
      true,
    );
  });

  it('requires matching Bearer when secret is set', () => {
    const env = {
      NODE_ENV: 'development',
      CRON_SECRET: 'test-cron-secret',
    } as NodeJS.ProcessEnv;
    const bad = new Request('http://localhost/api/cron/x', {
      headers: { authorization: 'Bearer wrong' },
    });
    const good = new Request('http://localhost/api/cron/x', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    assert.equal(authorizeCronRequest(bad, env), false);
    assert.equal(authorizeCronRequest(good, env), true);
  });

  it('denies missing Authorization when secret is set in production', () => {
    const env = {
      NODE_ENV: 'production',
      CRON_SECRET: 'prod-secret',
    } as NodeJS.ProcessEnv;
    const req = new Request('https://example.com/api/cron/x');
    assert.equal(authorizeCronRequest(req, env), false);
  });
});
