import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  PRODUCTION_SUPABASE_PROJECT_REF,
  canWritePreviewIdentityData,
  decidePreviewIdentityWrite,
  describeDatabaseFingerprint,
} from '@/lib/jar-exchange/partner-store-identity-isolation';
import { PREVIEW_ACCEPTANCE_ROWS } from '@/lib/jar-exchange/partner-store-identity-acceptance-rows';

describe('partner store identity isolation', () => {
  it('fingerprints supabase URLs without keeping the password', () => {
    const fp = describeDatabaseFingerprint(
      `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_REF}:secret-must-not-leak@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
    );
    assert.ok(fp);
    assert.equal(fp?.projectRef, PRODUCTION_SUPABASE_PROJECT_REF);
    assert.equal(fp?.hostTail, 'pooler.supabase.com');
    assert.equal(fp?.databaseName, 'postgres');
    assert.equal(fp?.port, 6543);
    assert.equal(JSON.stringify(fp).includes('secret-must-not-leak'), false);
  });

  it('refuses production and the official supabase project', () => {
    assert.equal(
      canWritePreviewIdentityData({
        VERCEL_ENV: 'production',
        DATABASE_URL: `postgresql://postgres.otherproj:x@db.example.com:5432/postgres`,
      }),
      false,
    );
    const shared = decidePreviewIdentityWrite({
      VERCEL_ENV: 'preview',
      DATABASE_URL: `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_REF}:x@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`,
    });
    assert.equal(shared.isolated, false);
    if (!shared.isolated) {
      assert.equal(shared.reason, 'same_as_production_supabase');
    }
  });

  it('allows preview only when the project ref is different', () => {
    const decision = decidePreviewIdentityWrite({
      VERCEL_ENV: 'preview',
      DATABASE_URL: 'postgresql://postgres.previewonly123:x@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres',
    });
    assert.equal(decision.isolated, true);
    if (decision.isolated) {
      assert.equal(decision.fingerprint.projectRef, 'previewonly123');
    }
  });

  it('lists exactly eight planned acceptance rows', () => {
    assert.equal(PREVIEW_ACCEPTANCE_ROWS.length, 8);
    assert.deepEqual(
      PREVIEW_ACCEPTANCE_ROWS.map((row) => [row.legacySlug, row.merchantId, row.verdict]),
      [
        ['zhuwo_banqiao', 'MER-0019', 'same_store'],
        ['zhuwo_tucheng', 'MER-0020', 'same_store'],
        ['zhuwo_zhonghe', 'MER-0016', 'same_store'],
        ['manlisa', 'MER-0017', 'same_store'],
        ['niuniu', 'MER-0010', 'same_store'],
        ['mer_other', 'MER-OTHER', 'test'],
        ['mer_refill', 'MER-REFILL', 'test'],
        [null, 'MER-DEMO', 'demo'],
      ],
    );
  });

  it('stores page loads without seeding or creating tables', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'app/(main)/jar-exchange/stores/page.tsx'),
      'utf8',
    );
    assert.equal(src.includes('seedPreviewIdentityDecisions'), false);
    assert.equal(src.includes('ensurePreviewIdentityTable'), false);
    assert.equal(src.includes('getCurrentUser'), false);
    assert.match(src, /listIdentityDecisions/);
  });
});
