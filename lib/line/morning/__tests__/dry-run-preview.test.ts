import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isMorningPreviewTestMember,
  runMorningDryRunPreview,
} from '../dry-run-preview';

describe('HQ dry-run preview guards', () => {
  it('U_TEST_ 前綴才算測試會員', () => {
    assert.equal(isMorningPreviewTestMember('U_TEST_abc'), true);
    assert.equal(isMorningPreviewTestMember('Urealuser'), false);
  });

  it('未勾選確認 → 拒絕（防批次擴張）', async () => {
    await assert.rejects(
      () =>
        runMorningDryRunPreview({
          lineUserId: 'U_TEST_x',
          contentMode: 'jokes',
          taipeiDate: '2026-08-08',
          confirmTestPreview: false,
        }),
      /Preview 測試/,
    );
  });
});
