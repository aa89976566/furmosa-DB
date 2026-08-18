import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { SETTLEMENT_LOCKED } from '../copy';
import { SETTLEMENTS } from '../fixtures';
import {
  expectedFurmosaNetTwd,
  expectedMerchantNetTwd,
  expectedNetDirection,
  expectedTotalNetTwd,
  settlementViews,
} from '../selectors';

describe('merchant POS preview settlement snapshot', () => {
  it('keeps every snapshot internally consistent with the displayed equation', () => {
    const views = settlementViews();
    assert.equal(views.length, SETTLEMENTS.length);

    for (const row of views) {
      assert.equal(Number.isInteger(row.merchantCollectedNetTwd), true, row.settlementId);
      assert.equal(Number.isInteger(row.furmosaCollectedNetTwd), true, row.settlementId);
      assert.equal(Number.isInteger(row.netAmountTwd), true, row.settlementId);
      assert.equal(expectedMerchantNetTwd(row), row.merchantCollectedNetTwd, row.settlementId);
      assert.equal(expectedFurmosaNetTwd(row), row.furmosaCollectedNetTwd, row.settlementId);
      assert.equal(expectedTotalNetTwd(row), row.netAmountTwd, row.settlementId);
      assert.equal(
        row.ordinaryCommissionSnapshotTwd,
        row.merchantCollectedCommissionTwd + row.furmosaCollectedCommissionTwd,
        row.settlementId,
      );
      assert.equal(
        row.voucherFixedSubsidyTwd,
        row.merchantCollectedVoucherSubsidyTwd + row.furmosaCollectedVoucherSubsidyTwd,
        row.settlementId,
      );
      assert.equal(
        row.refundNextPeriodAdjustmentTwd,
        row.merchantCollectedRefundAdjustmentTwd + row.furmosaCollectedRefundAdjustmentTwd,
        row.settlementId,
      );
      assert.equal(row.netDirection, expectedNetDirection(row.netAmountTwd), row.settlementId);
    }
  });

  it('locks approved and paid periods without reopen or pay actions', () => {
    const approved = settlementViews().find((row) => row.status === 'approved');
    const paid = settlementViews().find((row) => row.status === 'paid');
    assert.ok(approved && paid);
    assert.equal(approved.locked, true);
    assert.equal(paid.locked, true);
    assert.equal(approved.lockNote, SETTLEMENT_LOCKED);
    assert.equal(paid.lockNote, SETTLEMENT_LOCKED);

    const src = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/settlement-panel.tsx'),
      'utf8',
    );
    assert.equal(src.includes('重開'), false);
    assert.equal(src.includes('付款'), false);
    assert.equal(src.includes('編輯'), false);
    assert.equal(src.includes('<Button'), false);
    assert.match(src, /SETTLEMENT_LOCKED/);
    assert.match(src, /SETTLEMENT_EQ_MERCHANT/);
  });
});
