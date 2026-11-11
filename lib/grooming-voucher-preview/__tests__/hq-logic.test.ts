import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COPY } from '../copy';
import { HQ_CANCEL_REQUESTS } from '../fixtures';
import {
  approveConfirmCopy,
  approveRequest,
  cloneHqRequests,
  lockedPeriodCopy,
  rejectRequest,
  requestsForTab,
  voucherStaysVoidAfterApprove,
} from '../hq-logic';

describe('grooming voucher HQ preview logic', () => {
  it('splits cancel requests into three tabs', () => {
    const rows = cloneHqRequests();
    assert.equal(requestsForTab(rows, 'pending').length, 2);
    assert.equal(requestsForTab(rows, 'approved').length, 1);
    assert.equal(requestsForTab(rows, 'rejected').length, 1);
  });

  it('approve copy names points, reversal, and permanent void', () => {
    const pending = HQ_CANCEL_REQUESTS.find((row) => row.id === 'cxl-preview-01');
    assert.ok(pending);
    const copy = approveConfirmCopy(pending);
    assert.match(copy, /退回 10 點/);
    assert.match(copy, /沖銷 NT\$200/);
    assert.match(copy, /原券永久作廢/);
  });

  it('locked-period pending row uses next-period copy and does not reopen', () => {
    const locked = HQ_CANCEL_REQUESTS.find((row) => row.id === 'cxl-preview-02');
    assert.ok(locked);
    assert.equal(locked.periodLocked, true);
    assert.equal(lockedPeriodCopy(locked), COPY.lockedPeriod);
    assert.equal(locked.lockedPeriodLabel, '2026/07');

    const result = approveRequest(cloneHqRequests(), locked.id);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const updated = result.requests.find((row) => row.id === locked.id);
    assert.ok(updated);
    assert.equal(updated.tab, 'approved');
    const last = updated.timeline[updated.timeline.length - 1];
    assert.match(last.detail, /將列入下一期調整/);
    assert.equal(last.detail.includes('重開'), false);
    assert.equal(voucherStaysVoidAfterApprove(updated), true);
  });

  it('approve moves the row and keeps the voucher void', () => {
    const result = approveRequest(cloneHqRequests(), 'cxl-preview-01');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const updated = result.requests.find((row) => row.id === 'cxl-preview-01');
    assert.ok(updated);
    assert.equal(updated.tab, 'approved');
    assert.equal(voucherStaysVoidAfterApprove(updated), true);
    assert.match(updated.timeline.at(-1)?.detail ?? '', /原券永久作廢/);
  });

  it('reject requires a short note', () => {
    const missing = rejectRequest(cloneHqRequests(), 'cxl-preview-01', '   ');
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.error, COPY.rejectNoteRequired);

    const ok = rejectRequest(cloneHqRequests(), 'cxl-preview-01', '服務已完成。');
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    const updated = ok.requests.find((row) => row.id === 'cxl-preview-01');
    assert.equal(updated?.tab, 'rejected');
    assert.equal(updated?.rejectNote, '服務已完成。');
  });

  it('does not re-approve a finished row', () => {
    const first = approveRequest(cloneHqRequests(), 'cxl-preview-01');
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = approveRequest(first.requests, 'cxl-preview-01');
    assert.equal(second.ok, false);
  });
});
