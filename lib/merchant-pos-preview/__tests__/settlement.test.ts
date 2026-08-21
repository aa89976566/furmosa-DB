import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { SETTLEMENT_INTRO, SETTLEMENT_LOCKED } from '../copy';
import { SETTLEMENTS } from '../fixtures';
import {
  netDirectionFromSignedSum,
  settlementViews,
  sumHqPerspectiveSigned,
} from '../selectors';
import type { SettlementLedgerRow, SettlementSnapshot } from '../types';

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

function expectedSignedFromDirection(row: SettlementLedgerRow): number {
  if (row.kind === 'audit' || row.periodRoute === 'next_period') return 0;
  if (row.direction === 'hq_owes_merchant') return row.amountTwd;
  if (row.direction === 'merchant_owes_hq') return -row.amountTwd;
  return 0;
}

function assertLedgerRow(row: SettlementLedgerRow, settlementId: string) {
  assert.equal(Number.isInteger(row.amountTwd) && row.amountTwd > 0, true, `${settlementId}:${row.rowId}`);
  assert.ok(row.label, `${settlementId}:${row.rowId} label`);
  assert.ok(row.source, `${settlementId}:${row.rowId} source`);
  assert.ok(row.payer, `${settlementId}:${row.rowId} payer`);
  assert.ok(row.payee, `${settlementId}:${row.rowId} payee`);
  assert.ok(row.note, `${settlementId}:${row.rowId} note`);
  assert.ok(row.periodRoute, `${settlementId}:${row.rowId} periodRoute`);
  assert.equal(row.hqPerspectiveSignedTwd, expectedSignedFromDirection(row), `${settlementId}:${row.rowId}`);
}

function assertSnapshot(row: SettlementSnapshot) {
  for (const item of row.ledger) {
    assertLedgerRow(item, row.settlementId);
  }
  const signedSum = sumHqPerspectiveSigned(row.ledger);
  assert.equal(signedSum, row.netAmountTwd, row.settlementId);
  assert.equal(row.netDirection, netDirectionFromSignedSum(signedSum), row.settlementId);
  if (signedSum > 0) {
    assert.equal(row.netDirection, 'hq_owes_merchant', row.settlementId);
    assert.equal(row.netDirectionLabel, '總部應付門市', row.settlementId);
  } else if (signedSum < 0) {
    assert.equal(row.netDirection, 'merchant_owes_hq', row.settlementId);
    assert.equal(row.netDirectionLabel, '門市應匯總部', row.settlementId);
  }
}

describe('merchant POS preview settlement snapshot', () => {
  it('uses fixture signed ledger rows and a single HQ-perspective sum', () => {
    const views = settlementViews();
    assert.equal(views.length, SETTLEMENTS.length);
    assert.equal(SETTLEMENT_INTRO, '金額以總部結算結果為準。');

    for (const row of views) {
      assertSnapshot(row);
    }

    const draft = views.find((row) => row.settlementId === 'stl-draft');
    const reviewing = views.find((row) => row.settlementId === 'stl-reviewing');
    const approved = views.find((row) => row.settlementId === 'stl-approved');
    const paid = views.find((row) => row.settlementId === 'stl-paid');
    assert.ok(draft && reviewing && approved && paid);

    const draftRemit = draft.ledger.find((item) => item.rowId === 'stl-draft-remit');
    const draftOfficialSales = draft.ledger.find((item) => item.rowId === 'stl-draft-audit-official-sales');
    const draftOfficialCommission = draft.ledger.find((item) => item.rowId === 'stl-draft-official-commission');
    const draftVoucher = draft.ledger.find((item) => item.rowId === 'stl-draft-voucher');
    assert.ok(draftRemit && draftOfficialSales && draftOfficialCommission && draftVoucher);
    assert.equal(draftRemit.direction, 'merchant_owes_hq');
    assert.equal(draftRemit.kind, 'obligation');
    assert.equal(draftOfficialSales.kind, 'audit');
    assert.equal(draftOfficialSales.hqPerspectiveSignedTwd, 0);
    assert.equal(draftOfficialCommission.direction, 'hq_owes_merchant');
    assert.equal(draftVoucher.direction, 'hq_owes_merchant');
    assert.equal(draft.netDirection, 'merchant_owes_hq');
    assert.equal(draft.netAmountTwd, -9940);

    const nextPeriod = reviewing.ledger.find((item) => item.periodRoute === 'next_period');
    const thisRefund = reviewing.ledger.find((item) => item.rowId === 'stl-reviewing-refund-clawback');
    assert.ok(nextPeriod && thisRefund);
    assert.equal(nextPeriod.hqPerspectiveSignedTwd, 0);
    assert.equal(thisRefund.direction, 'merchant_owes_hq');
    assert.equal(reviewing.netDirection, 'merchant_owes_hq');

    assert.equal(approved.netDirection, 'hq_owes_merchant');
    assert.equal(approved.netAmountTwd, 2280);
    assert.equal(paid.netDirection, 'merchant_owes_hq');
    assert.equal(paid.netAmountTwd, -6480);
  });

  it('locks approved and paid periods without reopen or pay actions', () => {
    const approved = settlementViews().find((row) => row.status === 'approved');
    const paid = settlementViews().find((row) => row.status === 'paid');
    assert.ok(approved && paid);
    assert.equal(approved.locked, true);
    assert.equal(paid.locked, true);
    assert.equal(approved.lockNote, SETTLEMENT_LOCKED);
    assert.equal(paid.lockNote, SETTLEMENT_LOCKED);
    assert.ok(approved.ledger.some((item) => item.periodRoute === 'next_period'));
    assert.ok(paid.ledger.some((item) => item.periodRoute === 'next_period'));

    const src = read('components/merchant-pos-preview/settlement-panel.tsx');
    const copy = read('lib/merchant-pos-preview/copy.ts');
    const selectors = read('lib/merchant-pos-preview/selectors.ts');
    assert.equal(src.includes('重開'), false);
    assert.equal(src.includes('付款'), false);
    assert.equal(src.includes('編輯'), false);
    assert.equal(src.includes('<Button'), false);
    assert.match(src, /SETTLEMENT_LOCKED/);
    assert.match(src, /SETTLEMENT_INTRO/);
    assert.match(src, /Math\.abs\(row\.netAmountTwd\)/);
    assert.equal(src.includes('SETTLEMENT_EQ_'), false);
    assert.equal(src.includes('ChannelBlock'), false);
    assert.equal(src.includes('merchantCollectedSalesTwd'), false);
    assert.equal(copy.includes('SETTLEMENT_EQ_'), false);
    assert.equal(selectors.includes('expectedMerchantNetTwd'), false);
    assert.equal(selectors.includes('expectedFurmosaNetTwd'), false);
    assert.equal(selectors.includes('expectedTotalNetTwd'), false);
  });

  it('presents one clear result before collapsible payment and audit details', () => {
    const src = read('components/merchant-pos-preview/settlement-panel.tsx');
    const css = read('app/preview/merchant-pos/merchant-pos.module.css');

    assert.match(src, /本期結算結果/);
    assert.match(src, /門市應付/);
    assert.match(src, /總部應付/);
    assert.match(src, /本期款項/);
    assert.match(src, /下期調整/);
    assert.match(src, /銷售對帳/);
    assert.match(src, /只供核對收款，不影響本期應付金額/);
    assert.match(src, /<details className=\{styles\.settlementDetailRow\}>/);
    assert.match(src, /item\.kind === 'obligation' && item\.periodRoute === 'this_period'/);
    assert.equal(src.includes('row.amountTwd -'), false);
    assert.equal(src.includes('commission'), false);
    assert.match(css, /\.settlementResultAmount\s*\{/);
    assert.match(css, /\.settlementEquation\s*\{/);
    assert.match(css, /\.settlementDetailSummary:focus-visible\s*\{/);
  });
});
