import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  IDENTITY_WRITE_OPERATIONS,
  PREVIEW_READONLY_MESSAGE,
  PRODUCTION_FEATURE_OFF_MESSAGE,
  decideIdentityWrite,
  denyIdentityWrite,
} from '@/lib/jar-exchange/partner-store-identity-write-guard';
import {
  activatePartnerStoreIdentity,
  addPartnerStoreIdentity,
  confirmPartnerStoreIdentity,
  createPreviewAcceptanceIdentityData,
  deletePartnerStoreIdentity,
  modifyPartnerStoreIdentity,
  revokePartnerStoreIdentity,
} from '@/app/(main)/jar-exchange/stores/actions';

const previewEnv = { VERCEL_ENV: 'preview' };

describe('partner store identity write guard', () => {
  it('rejects every write operation in Preview before any database call', () => {
    assert.deepEqual(IDENTITY_WRITE_OPERATIONS, [
      'create_acceptance',
      'confirm',
      'revoke',
      'add',
      'activate',
      'modify',
      'delete',
    ]);
    for (const operation of IDENTITY_WRITE_OPERATIONS) {
      const decision = decideIdentityWrite(operation, previewEnv);
      assert.equal(decision.allowed, false);
      if (!decision.allowed) {
        assert.equal(decision.reason, 'preview_readonly');
        assert.equal(decision.error, PREVIEW_READONLY_MESSAGE);
      }
    }
  });

  it('keeps Production writes off unless the later rollout flag is enabled', () => {
    const off = decideIdentityWrite('confirm', { VERCEL_ENV: 'production' });
    assert.equal(off.allowed, false);
    if (!off.allowed) {
      assert.equal(off.reason, 'feature_off');
      assert.equal(off.error, PRODUCTION_FEATURE_OFF_MESSAGE);
    }
    const on = decideIdentityWrite('confirm', {
      VERCEL_ENV: 'production',
      PARTNER_STORE_IDENTITY_WRITES: 'enabled',
    });
    assert.equal(on.allowed, true);
  });

  it('lets local or CI confirm and revoke, but not add or delete', () => {
    assert.equal(decideIdentityWrite('confirm', {}).allowed, true);
    assert.equal(decideIdentityWrite('revoke', {}).allowed, true);
    assert.equal(decideIdentityWrite('add', {}).allowed, false);
    assert.equal(decideIdentityWrite('delete', {}).allowed, false);
  });

  it('server actions all return the Preview refusal', async () => {
    const previous = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = 'preview';
    try {
      const results = await Promise.all([
        createPreviewAcceptanceIdentityData(),
        confirmPartnerStoreIdentity(),
        revokePartnerStoreIdentity(),
        addPartnerStoreIdentity(),
        activatePartnerStoreIdentity(),
        modifyPartnerStoreIdentity(),
        deletePartnerStoreIdentity(),
      ]);
      assert.equal(results.length, IDENTITY_WRITE_OPERATIONS.length);
      for (const result of results) {
        assert.equal(result.ok, false);
        if (!result.ok) {
          assert.equal(result.error, PREVIEW_READONLY_MESSAGE);
          assert.equal(result.reason, 'preview_readonly');
        }
      }
    } finally {
      if (previous === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previous;
    }
  });

  it('store write functions also refuse Preview', async () => {
    const { createIdentityDecision, revokeIdentityDecision } = await import(
      '@/lib/jar-exchange/partner-store-identity-store'
    );
    const created = await createIdentityDecision({
      merchantId: 'MER-0099',
      legacySlug: 'anon_store',
      verdict: 'same_store',
      decidedByUserId: 'user_hq',
      decidedByAccount: 'hq@example.test',
      rationale: 'should not write',
      otherRecordDisposition: 'keep_legacy_link',
      env: previewEnv,
    });
    const revoked = await revokeIdentityDecision({
      id: 'does-not-matter',
      revokedByUserId: 'user_hq',
      revokedByAccount: 'hq@example.test',
      revokeReason: 'should not write',
      env: previewEnv,
    });
    assert.equal(created.ok, false);
    assert.equal(revoked.ok, false);
    if (!created.ok) assert.equal(created.error, PREVIEW_READONLY_MESSAGE);
    if (!revoked.ok) assert.equal(revoked.error, PREVIEW_READONLY_MESSAGE);
  });

  it('preview seed helpers no-op when Preview write is denied', async () => {
    const previous = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = 'preview';
    try {
      const { ensurePreviewIdentityTable, seedPreviewIdentityDecisions } = await import(
        '@/lib/jar-exchange/partner-store-identity-preview'
      );
      await ensurePreviewIdentityTable();
      const inserted = await seedPreviewIdentityDecisions({
        userId: 'user_hq',
        email: 'hq@example.test',
      });
      assert.equal(inserted, 0);
    } finally {
      if (previous === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previous;
    }
  });

  it('deny helper matches the Preview refusal shape', () => {
    const denied = denyIdentityWrite('modify', previewEnv);
    assert.ok(denied);
    assert.equal(denied?.ok, false);
    assert.equal(denied?.error, PREVIEW_READONLY_MESSAGE);
    assert.equal(denyIdentityWrite('confirm', {}), null);
  });
});

describe('preview readonly page copy', () => {
  it('shows the Preview banner only when VERCEL_ENV is preview', () => {
    const page = readFileSync(
      path.join(process.cwd(), 'app/(main)/jar-exchange/stores/page.tsx'),
      'utf8',
    );
    assert.match(page, /PreviewModeBanner/);
    assert.match(page, /isPreviewIdentityEnv/);
    assert.match(page, /writesDisabled=\{preview\}/);
    assert.match(page, /listIdentityDecisions\('production'\)/);
    assert.equal(page.includes('seedPreviewIdentityDecisions'), false);
    assert.equal(page.includes('ensurePreviewIdentityTable'), false);
    assert.equal(page.includes('getCurrentUser'), false);
    assert.equal(page.includes('PreviewAcceptanceSeedPanel'), false);
  });

  it('banner and notice use the locked Preview wording', () => {
    const banner = readFileSync(
      path.join(process.cwd(), 'components/jar-exchange/preview-mode-banner.tsx'),
      'utf8',
    );
    const notice = readFileSync(
      path.join(process.cwd(), 'components/jar-exchange/preview-readonly-notice.tsx'),
      'utf8',
    );
    assert.match(banner, /預覽模式｜不會儲存變更/);
    assert.match(notice, /disabled/);
    assert.match(notice, /確認/);
    assert.match(notice, /撤銷/);
    assert.match(notice, /新增/);
    assert.match(notice, /開通/);
    assert.match(notice, /修改/);
    assert.match(notice, /刪除/);
  });

  it('directory write buttons are disabled attributes, not click-then-error', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'components/jar-exchange/partner-stores-directory.tsx'),
      'utf8',
    );
    assert.match(src, /writesDisabled/);
    assert.match(src, /disabled/);
    assert.equal(src.includes('confirmPartnerStoreIdentity'), false);
    assert.equal(src.includes('revokePartnerStoreIdentity'), false);
  });
});
