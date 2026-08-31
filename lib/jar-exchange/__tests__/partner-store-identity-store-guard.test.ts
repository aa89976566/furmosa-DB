import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  BLOCKED_REAL_STORE_MESSAGE,
  PREVIEW_READONLY_MESSAGE,
} from '@/lib/jar-exchange/partner-store-identity-write-guard';

describe('identity store write refusals', () => {
  it('refuses Preview and the five real stores before touching official rows', async () => {
    const { createIdentityDecision } = await import(
      '@/lib/jar-exchange/partner-store-identity-store'
    );
    const preview = await createIdentityDecision({
      merchantId: 'MER-DEMO',
      legacySlug: null,
      verdict: 'demo',
      decidedByUserId: 'user_hq',
      decidedByAccount: 'hq@example.test',
      rationale: 'should not write',
      otherRecordDisposition: 'keep_legacy_link',
      env: { VERCEL_ENV: 'preview' },
    });
    const realStore = await createIdentityDecision({
      merchantId: 'MER-0019',
      legacySlug: 'zhuwo_banqiao',
      verdict: 'same_store',
      decidedByUserId: 'user_hq',
      decidedByAccount: 'hq@example.test',
      rationale: 'should not write',
      otherRecordDisposition: 'keep_legacy_link',
    });
    assert.equal(preview.ok, false);
    assert.equal(realStore.ok, false);
    if (!preview.ok) assert.equal(preview.error, PREVIEW_READONLY_MESSAGE);
    if (!realStore.ok) assert.equal(realStore.error, BLOCKED_REAL_STORE_MESSAGE);
  });

  it('production page has no Preview overlay and gates the approved-five batch', () => {
    const page = readFileSync(
      path.join(process.cwd(), 'app/(main)/jar-exchange/stores/page.tsx'),
      'utf8',
    );
    assert.match(page, /listIdentityDecisions\('production'\)/);
    assert.equal(page.includes('withPreviewReadOnlyOverlay'), false);
    assert.equal(page.includes('預覽模式'), false);
    assert.match(page, /LimitedRolloutDemoPanel/);
    assert.match(page, /ApprovedFiveRolloutPanel/);
    assert.match(page, /isApprovedFiveWriteTarget/);
  });
});
