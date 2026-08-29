import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  RESTOCK_APPROVABLE_STATUSES,
  restockStatusLabelForHq,
} from '@/lib/restock-request/constants';
import {
  HQ_RESTOCK_INBOX_COMPLETED_STATUSES,
  HQ_RESTOCK_INBOX_HIDDEN_STATUSES,
  HQ_RESTOCK_INBOX_LIST_SELECT,
  HQ_RESTOCK_INBOX_PAGE_SIZE,
  HQ_RESTOCK_INBOX_PATH,
  HQ_RESTOCK_INBOX_PENDING_STATUSES,
  HQ_RESTOCK_INBOX_PROCESSING_STATUSES,
  canAccessHqRestockInbox,
  compareHqRestockInboxRows,
  hqRestockInboxBadgeVisible,
  hqRestockInboxBucket,
  hqRestockInboxBucketCounts,
  hqRestockInboxEmptyMessage,
  hqRestockInboxListWhere,
  hqRestockInboxRevalidatePaths,
  hqRestockInboxSearchWhere,
  hqRestockInboxStatusesForFilter,
  hqRestockRequestDetailHref,
  mapHqRestockInboxRow,
  parseHqRestockInboxFilter,
  restockRequestNumber,
} from '@/lib/restock-request/hq-inbox';

describe('HQ restock inbox status policy', () => {
  it('treats submitted as pending inbox work', () => {
    assert.deepEqual(HQ_RESTOCK_INBOX_PENDING_STATUSES, ['submitted']);
    assert.equal(hqRestockInboxBucket('submitted'), 'pending');
    assert.ok(hqRestockInboxStatusesForFilter('pending').includes('submitted'));
  });

  it('does not treat draft as a merchant-submitted request', () => {
    assert.deepEqual(HQ_RESTOCK_INBOX_HIDDEN_STATUSES, ['draft']);
    assert.equal(hqRestockInboxBucket('draft'), null);
    assert.equal(hqRestockInboxStatusesForFilter('pending').includes('draft'), false);
    assert.equal(hqRestockInboxStatusesForFilter('all').includes('draft'), false);
  });

  it('does not count rejected or cancelled in the pending badge', () => {
    assert.equal(hqRestockInboxBucket('rejected'), 'completed');
    assert.equal(hqRestockInboxBucket('cancelled'), 'completed');
    assert.equal(HQ_RESTOCK_INBOX_PENDING_STATUSES.includes('rejected'), false);
    assert.equal(HQ_RESTOCK_INBOX_PENDING_STATUSES.includes('cancelled'), false);
  });

  it('classifies converted and finished statuses as completed', () => {
    assert.deepEqual(HQ_RESTOCK_INBOX_COMPLETED_STATUSES, [
      'converted_to_shipment',
      'rejected',
      'cancelled',
    ]);
    assert.equal(hqRestockInboxBucket('converted_to_shipment'), 'completed');
    assert.equal(hqRestockInboxBucket('approved'), 'processing');
    assert.equal(hqRestockInboxBucket('under_review'), 'processing');
    assert.deepEqual(HQ_RESTOCK_INBOX_PROCESSING_STATUSES, ['under_review', 'approved']);
  });

  it('keeps count buckets aligned with the same status policy', () => {
    const counts = hqRestockInboxBucketCounts([
      { status: 'submitted', count: 3 },
      { status: 'draft', count: 9 },
      { status: 'under_review', count: 1 },
      { status: 'approved', count: 2 },
      { status: 'converted_to_shipment', count: 4 },
      { status: 'rejected', count: 1 },
    ]);
    assert.equal(counts.pending, 3);
    assert.equal(counts.processing, 3);
    assert.equal(counts.completed, 5);
    assert.equal(counts.all, 11);
    assert.deepEqual(hqRestockInboxStatusesForFilter('pending'), ['submitted']);
  });

  it('hides the navigation badge when pending is 0', () => {
    assert.equal(hqRestockInboxBadgeVisible(0), false);
    assert.equal(hqRestockInboxBadgeVisible(4), true);
  });
});

describe('HQ restock inbox sort and filters', () => {
  it('puts pending first and newest first within the same status', () => {
    const olderSubmitted = {
      status: 'submitted',
      createdAt: new Date('2026-08-01T00:00:00Z'),
    };
    const newerSubmitted = {
      status: 'submitted',
      createdAt: new Date('2026-08-20T00:00:00Z'),
    };
    const newestConverted = {
      status: 'converted_to_shipment',
      createdAt: new Date('2026-08-29T00:00:00Z'),
    };
    const rows = [newestConverted, olderSubmitted, newerSubmitted];
    rows.sort(compareHqRestockInboxRows);
    assert.deepEqual(
      rows.map((row) => `${row.status}:${row.createdAt.toISOString().slice(0, 10)}`),
      ['submitted:2026-08-20', 'submitted:2026-08-01', 'converted_to_shipment:2026-08-29'],
    );
  });

  it('defaults to pending and maps legacy status query strings to buckets', () => {
    assert.equal(parseHqRestockInboxFilter(), 'pending');
    assert.equal(parseHqRestockInboxFilter('processing'), 'processing');
    assert.equal(parseHqRestockInboxFilter(undefined, 'converted_to_shipment'), 'completed');
    assert.equal(parseHqRestockInboxFilter('nope', 'rejected'), 'completed');
  });
});

describe('HQ restock inbox list presentation', () => {
  it('maps request number, merchant, times, item count, quantity, status, and detail href', () => {
    const row = mapHqRestockInboxRow({
      id: 'clrestockrequest01',
      status: 'submitted',
      createdAt: new Date('2026-08-20T01:02:03Z'),
      updatedAt: new Date('2026-08-21T01:02:03Z'),
      merchantName: '淡水妞妞',
      merchantCode: 'MER-0001',
      itemCount: 2,
      totalRequestedQuantity: 8,
    });
    assert.equal(row.requestNumber, restockRequestNumber('clrestockrequest01'));
    assert.equal(row.merchantName, '淡水妞妞');
    assert.equal(row.merchantCode, 'MER-0001');
    assert.equal(row.itemCount, 2);
    assert.equal(row.totalRequestedQuantity, 8);
    assert.equal(row.statusLabel, restockStatusLabelForHq('submitted'));
    assert.equal(row.detailHref, hqRestockRequestDetailHref('clrestockrequest01'));
    assert.equal(row.detailHref, '/restock-requests/clrestockrequest01');
    assert.equal(row.createdAt.toISOString(), '2026-08-20T01:02:03.000Z');
    assert.equal(row.updatedAt.toISOString(), '2026-08-21T01:02:03.000Z');
  });

  it('does not select notes, snapshots, amounts, or credentials for the list', () => {
    const keys = Object.keys(HQ_RESTOCK_INBOX_LIST_SELECT);
    assert.deepEqual(keys.sort(), ['_count', 'createdAt', 'id', 'merchant', 'status', 'updatedAt'].sort());
    assert.equal('hqNote' in HQ_RESTOCK_INBOX_LIST_SELECT, false);
    assert.equal('merchantNote' in HQ_RESTOCK_INBOX_LIST_SELECT, false);
    assert.equal('approvedSnapshot' in HQ_RESTOCK_INBOX_LIST_SELECT, false);
    assert.equal('expectedArrivalDate' in HQ_RESTOCK_INBOX_LIST_SELECT, false);
    assert.equal('items' in HQ_RESTOCK_INBOX_LIST_SELECT, false);
  });

  it('searches request id, merchant name, and merchant code on the server where clause', () => {
    const where = hqRestockInboxSearchWhere('MER-0001');
    assert.ok(where?.OR);
    const or = where?.OR ?? [];
    assert.equal(or.some((clause) => 'id' in clause), true);
    assert.deepEqual(or[1], { merchant: { name: { contains: 'MER-0001', mode: 'insensitive' } } });
    assert.deepEqual(or[2], {
      merchant: { merchantId: { contains: 'MER-0001', mode: 'insensitive' } },
    });
    const listWhere = hqRestockInboxListWhere({ filter: 'pending', query: '妞妞' });
    assert.ok(listWhere.AND);
  });

  it('uses a page size instead of loading every historical request', () => {
    assert.equal(HQ_RESTOCK_INBOX_PAGE_SIZE, 30);
    assert.ok(HQ_RESTOCK_INBOX_PAGE_SIZE < 100);
  });

  it('explains an empty pending inbox and keeps the HQ path stable', () => {
    assert.equal(hqRestockInboxEmptyMessage('pending'), '目前沒有待處理的補貨申請。');
    assert.equal(HQ_RESTOCK_INBOX_PATH, '/restock-requests');
    assert.deepEqual(hqRestockInboxRevalidatePaths(), ['/restock-requests']);
  });
});

describe('HQ restock inbox authorization', () => {
  it('requires an HQ session and ignores a POS merchant session', () => {
    assert.equal(
      canAccessHqRestockInbox({ hasHqSession: false, hasMerchantSession: false }),
      false,
    );
    assert.equal(
      canAccessHqRestockInbox({ hasHqSession: false, hasMerchantSession: true }),
      false,
    );
    assert.equal(
      canAccessHqRestockInbox({ hasHqSession: true, hasMerchantSession: false }),
      true,
    );
  });
});

describe('HQ restock inbox does not change request status policy', () => {
  it('does not add statuses or change approvable statuses', () => {
    assert.deepEqual(RESTOCK_APPROVABLE_STATUSES, ['submitted', 'under_review', 'approved']);
    assert.equal(restockStatusLabelForHq('submitted'), '待審核');
    assert.equal(restockStatusLabelForHq('under_review'), '審核中');
    assert.equal(restockStatusLabelForHq('approved'), '已核准（待轉單）');
    assert.equal(restockStatusLabelForHq('converted_to_shipment'), '已建立出貨單');
    assert.equal(restockStatusLabelForHq('rejected'), '已拒絕');
    assert.equal(restockStatusLabelForHq('cancelled'), '已取消');
  });
});
