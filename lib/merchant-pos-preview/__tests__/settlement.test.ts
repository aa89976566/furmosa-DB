import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { SETTLEMENT_LOCKED } from '../copy';
import { SETTLEMENTS } from '../fixtures';
import { settlementViews } from '../selectors';

describe('merchant POS preview settlement snapshot', () => {
  it('exposes fixture snapshots without recalculating', () => {
    const views = settlementViews();
    assert.deepEqual(
      views.map((row) => row.settlementId),
      SETTLEMENTS.map((row) => row.settlementId),
    );
    const draft = views.find((row) => row.status === 'draft');
    const reviewing = views.find((row) => row.status === 'reviewing');
    const approved = views.find((row) => row.status === 'approved');
    const paid = views.find((row) => row.status === 'paid');
    assert.ok(draft && reviewing && approved && paid);
    assert.equal(draft.netAmountTwd, 1540);
    assert.equal(approved.locked, true);
    assert.equal(paid.locked, true);
    assert.equal(approved.lockNote, SETTLEMENT_LOCKED);
    assert.equal(paid.lockNote, SETTLEMENT_LOCKED);
    assert.notEqual(
      draft.merchantCollectedSalesTwd +
        draft.furmosaCollectedSalesTwd -
        draft.ordinaryCommissionSnapshotTwd,
      draft.netAmountTwd,
    );
  });

  it('has no edit, pay or reopen actions', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/settlement-panel.tsx'),
      'utf8',
    );
    assert.equal(src.includes('重開'), false);
    assert.equal(src.includes('付款'), false);
    assert.equal(src.includes('編輯'), false);
    assert.equal(src.includes('<Button'), false);
    assert.match(src, /SETTLEMENT_LOCKED/);
  });
});
