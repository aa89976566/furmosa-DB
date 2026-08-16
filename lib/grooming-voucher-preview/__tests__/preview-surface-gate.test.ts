import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decideGroomingPreviewSurfaceAccess,
  GROOMING_PREVIEW_PATH,
  isExactGroomingPreviewPath,
  readPreviewSurfaceEnv,
  shouldBypassHqForGroomingPreviewSurface,
  type PreviewSurfaceEnv,
} from '../preview-surface-gate';

function fakeSurfaceEnv(overrides: Partial<PreviewSurfaceEnv> = {}): PreviewSurfaceEnv {
  return {
    VERCEL_ENV: 'preview',
    GROOMING_PREVIEW_AUTH_ENABLED: 'true',
    GROOMING_PREVIEW_BRANCH: 'cursor/grooming-voucher-preview-login-49d3',
    VERCEL_GIT_COMMIT_REF: 'cursor/grooming-voucher-preview-login-49d3',
    GROOMING_PREVIEW_COOKIE_SECRET: 'fake-preview-cookie-secret',
    ...overrides,
  };
}

describe('grooming preview surface gate (middleware layer)', () => {
  it('reads only named fake env keys', () => {
    const env = readPreviewSurfaceEnv({
      VERCEL_ENV: 'preview',
      GROOMING_PREVIEW_AUTH_ENABLED: 'true',
      GROOMING_PREVIEW_BRANCH: 'branch-a',
      VERCEL_GIT_COMMIT_REF: 'branch-a',
      GROOMING_PREVIEW_COOKIE_SECRET: 'secret',
      DATABASE_URL: 'must-not-be-copied',
    });
    assert.equal(env.VERCEL_ENV, 'preview');
    assert.equal('DATABASE_URL' in env, false);
  });

  it('exact path is only /preview/grooming-voucher', () => {
    assert.equal(isExactGroomingPreviewPath(GROOMING_PREVIEW_PATH), true);
    assert.equal(isExactGroomingPreviewPath('/preview/grooming-voucher/'), false);
    assert.equal(isExactGroomingPreviewPath('/preview/grooming-voucher/extra'), false);
    assert.equal(isExactGroomingPreviewPath('/preview/grooming-voucher-preview'), false);
    assert.equal(isExactGroomingPreviewPath('/pos/grooming-voucher-preview'), false);
    assert.equal(isExactGroomingPreviewPath('/preview'), false);
    assert.equal(isExactGroomingPreviewPath('/Preview/grooming-voucher'), false);
  });

  it('bypasses HQ only for exact path and open env gate', () => {
    assert.equal(
      decideGroomingPreviewSurfaceAccess({
        pathname: GROOMING_PREVIEW_PATH,
        env: fakeSurfaceEnv(),
      }),
      'bypass_hq',
    );
    assert.equal(
      shouldBypassHqForGroomingPreviewSurface({
        pathname: GROOMING_PREVIEW_PATH,
        env: fakeSurfaceEnv(),
      }),
      true,
    );
  });

  it('production does not bypass HQ', () => {
    assert.equal(
      decideGroomingPreviewSurfaceAccess({
        pathname: GROOMING_PREVIEW_PATH,
        env: fakeSurfaceEnv({ VERCEL_ENV: 'production' }),
      }),
      'continue',
    );
  });

  it('disabled or missing enabled does not bypass HQ', () => {
    assert.equal(
      decideGroomingPreviewSurfaceAccess({
        pathname: GROOMING_PREVIEW_PATH,
        env: fakeSurfaceEnv({ GROOMING_PREVIEW_AUTH_ENABLED: 'false' }),
      }),
      'continue',
    );
    assert.equal(
      decideGroomingPreviewSurfaceAccess({
        pathname: GROOMING_PREVIEW_PATH,
        env: fakeSurfaceEnv({ GROOMING_PREVIEW_AUTH_ENABLED: undefined }),
      }),
      'continue',
    );
    assert.equal(
      decideGroomingPreviewSurfaceAccess({
        pathname: GROOMING_PREVIEW_PATH,
        env: fakeSurfaceEnv({ GROOMING_PREVIEW_AUTH_ENABLED: 'TRUE' }),
      }),
      'continue',
    );
  });

  it('branch mismatch or empty branch does not bypass HQ', () => {
    assert.equal(
      decideGroomingPreviewSurfaceAccess({
        pathname: GROOMING_PREVIEW_PATH,
        env: fakeSurfaceEnv({ VERCEL_GIT_COMMIT_REF: 'some-other-branch' }),
      }),
      'continue',
    );
    assert.equal(
      decideGroomingPreviewSurfaceAccess({
        pathname: GROOMING_PREVIEW_PATH,
        env: fakeSurfaceEnv({
          GROOMING_PREVIEW_BRANCH: '',
          VERCEL_GIT_COMMIT_REF: '',
        }),
      }),
      'continue',
    );
  });

  it('missing cookie secret does not bypass HQ', () => {
    assert.equal(
      decideGroomingPreviewSurfaceAccess({
        pathname: GROOMING_PREVIEW_PATH,
        env: fakeSurfaceEnv({ GROOMING_PREVIEW_COOKIE_SECRET: undefined }),
      }),
      'continue',
    );
    assert.equal(
      decideGroomingPreviewSurfaceAccess({
        pathname: GROOMING_PREVIEW_PATH,
        env: fakeSurfaceEnv({ GROOMING_PREVIEW_COOKIE_SECRET: '   ' }),
      }),
      'continue',
    );
  });

  it('similar, encoded, and child paths never bypass HQ even when env is open', () => {
    const env = fakeSurfaceEnv();
    const rejected = [
      '/preview/grooming-voucher/',
      '/preview/grooming-voucher/extra',
      '/preview/grooming-vouchers',
      '/preview/grooming-voucher-preview',
      '/preview/%67rooming-voucher',
      '/preview/grooming-voucher%2Fextra',
      '/preview/grooming-voucher%2F',
      '/%70review/grooming-voucher',
      '/pos/grooming-voucher-preview',
      '/admin/grooming-voucher-preview',
      '/login',
      '/dashboard',
    ];
    for (const pathname of rejected) {
      assert.equal(
        decideGroomingPreviewSurfaceAccess({ pathname, env }),
        'continue',
        pathname,
      );
    }
  });

  it('does not inspect cookies; env-open exact path is enough', () => {
    const decision = decideGroomingPreviewSurfaceAccess({
      pathname: GROOMING_PREVIEW_PATH,
      env: fakeSurfaceEnv(),
    });
    assert.equal(decision, 'bypass_hq');
  });
});
