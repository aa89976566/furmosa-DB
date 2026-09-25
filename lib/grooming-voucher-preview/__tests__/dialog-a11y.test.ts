import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  hqDialogOpen,
  hqRememberRowTrigger,
  hqSelectedIdOnTabChange,
} from '../../../components/grooming-voucher-preview/hq-preview-app';
import {
  canRestoreDialogTrigger,
  HQ_APPROVE_SUCCESS_FOCUS_ID,
  isEscapeKey,
  nextTabIndex,
  POS_REDEEM_SUCCESS_FOCUS_ID,
  successFocusTargetId,
} from '../../../components/grooming-voucher-preview/pos-preview-app';
import {
  finishRedeem,
  openRedeemTask,
  openReview,
  simulateScan,
  startRedeem,
  createPosSession,
} from '../pos-logic';
import { approveRequest, cloneHqRequests } from '../hq-logic';
import type { PosSession } from '../types';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('preview dialog keyboard helper', () => {
  it('cycles Tab forward and Shift+Tab backward', () => {
    assert.equal(nextTabIndex(0, 3, false), 1);
    assert.equal(nextTabIndex(1, 3, false), 2);
    assert.equal(nextTabIndex(2, 3, false), 0);
    assert.equal(nextTabIndex(0, 3, true), 2);
    assert.equal(nextTabIndex(1, 3, true), 0);
    assert.equal(nextTabIndex(-1, 3, false), 0);
    assert.equal(nextTabIndex(-1, 3, true), 2);
    assert.equal(nextTabIndex(0, 0, false), 0);
  });

  it('treats only Escape as the close key', () => {
    assert.equal(isEscapeKey('Escape'), true);
    assert.equal(isEscapeKey('Esc'), false);
    assert.equal(isEscapeKey('Tab'), false);
    assert.equal(isEscapeKey('Enter'), false);
  });
});

describe('preview dialog semantics', () => {
  it('POS review dialog has modal semantics, trap, escape, and inert background', () => {
    const src = read('components/grooming-voucher-preview/pos-preview-app.tsx');
    assert.match(src, /role="dialog"/);
    assert.match(src, /aria-modal="true"/);
    assert.match(src, /aria-labelledby="redeem-review-title"/);
    assert.match(src, /inert:\s*true/);
    assert.match(src, /'aria-hidden':\s*true/);
    assert.match(src, /isEscapeKey\(event\.key\)/);
    assert.match(src, /event\.key !== 'Tab'/);
    assert.match(src, /nextTabIndex\(/);
    assert.match(src, /canRestoreDialogTrigger\(trigger\)/);
    assert.match(src, /first\.focus\(\)/);
    assert.match(src, /id=\{POS_REDEEM_SUCCESS_FOCUS_ID\}/);
    assert.match(src, /redeemSuccessRef\.current\?\.focus\(\)/);
  });

  it('HQ mobile overlay uses dialog semantics and the same keyboard helper', () => {
    const src = read('components/grooming-voucher-preview/hq-preview-app.tsx');
    assert.match(src, /role=\{isOverlay \? 'dialog' : undefined\}/);
    assert.match(src, /aria-modal=\{isOverlay \? true : undefined\}/);
    assert.match(src, /aria-labelledby=\{isOverlay \? titleId : undefined\}/);
    assert.match(src, /usePreviewDialogFocus\(/);
    assert.match(src, /inert:\s*true/);
    assert.match(src, /'aria-hidden':\s*true/);
    assert.doesNotMatch(src, /role="tab"/);
    assert.doesNotMatch(src, /role="tablist"/);
    assert.doesNotMatch(src, /aria-selected=/);
    assert.match(src, /aria-pressed=\{tab === item\}/);
    assert.match(src, /id=\{HQ_APPROVE_SUCCESS_FOCUS_ID\}/);
    assert.match(src, /successHeadingRef\.current\?\.focus\(\)/);
  });
});

describe('success focus targets after unmounting triggers', () => {
  function readyToRedeem(): PosSession {
    let session = createPosSession('available_200');
    session = openRedeemTask(session);
    session = simulateScan(session);
    return {
      ...session,
      serviceTotalInput: '880',
      serviceConfirmed: true,
    };
  }

  it('POS redeem success focuses the receipt heading, not a detached trigger', () => {
    const session = finishRedeem(startRedeem(openReview(readyToRedeem())));
    assert.equal(session.step, 'receipt');
    assert.equal(session.redeemed, true);
    assert.equal(successFocusTargetId('pos-redeem'), POS_REDEEM_SUCCESS_FOCUS_ID);
    assert.equal(canRestoreDialogTrigger({ isConnected: false }), false);
    assert.equal(canRestoreDialogTrigger(null), false);
  });

  it('HQ approve success focuses the approved status, not a detached row', () => {
    const result = approveRequest(cloneHqRequests(), 'cxl-preview-01');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const updated = result.requests.find((row) => row.id === 'cxl-preview-01');
    assert.equal(updated?.tab, 'approved');
    assert.equal(successFocusTargetId('hq-approve'), HQ_APPROVE_SUCCESS_FOCUS_ID);
    assert.equal(canRestoreDialogTrigger({ isConnected: true }), true);
    assert.equal(canRestoreDialogTrigger({ isConnected: false }), false);
  });
});

describe('HQ mobile dialog open rules', () => {
  it('does not open a dialog when switching tabs on mobile', () => {
    assert.equal(hqSelectedIdOnTabChange(true, 'cxl-preview-01'), null);
    assert.equal(hqDialogOpen(true, hqSelectedIdOnTabChange(true, 'cxl-preview-01')), false);
  });

  it('opens a dialog only after a row is selected on mobile', () => {
    assert.equal(hqDialogOpen(true, null), false);
    assert.equal(hqDialogOpen(true, 'cxl-preview-01'), true);
    assert.equal(hqSelectedIdOnTabChange(false, 'cxl-preview-01'), 'cxl-preview-01');
  });

  it('close focus target is the clicked row, not an unmounted map entry', () => {
    const clicked = { id: 'mounted-row' };
    const stale = { id: 'not-mounted' };
    const map = new Map<string, { id: string }>([['cxl-preview-01', stale]]);
    const remembered = hqRememberRowTrigger(clicked);
    assert.equal(remembered, clicked);
    assert.notEqual(remembered, map.get('cxl-preview-01'));
    assert.equal(hqRememberRowTrigger(null), null);
    assert.equal(hqRememberRowTrigger(undefined), null);
  });
});
