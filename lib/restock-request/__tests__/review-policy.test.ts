import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  RESTOCK_APPROVABLE_STATUSES,
  restockStatusLabelForMerchant,
} from '@/lib/restock-request/constants';
import { canTransitionRestockRequest } from '@/lib/pos/domain-contract';
import { canAccessHqRestockInbox } from '@/lib/restock-request/hq-inbox';
import {
  RESTOCK_REVIEW_CONFLICT_MESSAGE,
  assertApproveHasPositiveQty,
  assertHqReviewTransition,
  buildHqItemApprovals,
  canShowHqRestockReviewForm,
  domainAllowsReject,
  hqRestockAllowedActionLabels,
  hqRestockDetailViewMode,
  hqReviewActionStateFromError,
  hqReviewClaimCountIsConflict,
  hqReviewClaimWhere,
  isExistingApproveConvertShortcut,
  parseHqApprovedQuantity,
  parseHqExpectedArrivalDate,
  parseHqRejectNote,
  readHqReviewFormFields,
  requireHqReviewActor,
  RestockRequestConflictError,
} from '@/lib/restock-request/review-policy';

describe('HQ restock review transitions', () => {
  it('keeps the existing submitted → approved convert shortcut', () => {
    assert.equal(isExistingApproveConvertShortcut('submitted'), true);
    assert.equal(isExistingApproveConvertShortcut('under_review'), true);
    assert.equal(isExistingApproveConvertShortcut('approved'), true);
    assert.deepEqual(RESTOCK_APPROVABLE_STATUSES, [
      'submitted',
      'under_review',
      'approved',
    ]);
    assert.equal(canTransitionRestockRequest('submitted', 'approved'), false);
  });

  it('allows reject only from submitted and under_review', () => {
    assert.equal(domainAllowsReject('submitted'), true);
    assert.equal(domainAllowsReject('under_review'), true);
    assert.equal(domainAllowsReject('approved'), false);
    assert.equal(domainAllowsReject('rejected'), false);
    assert.equal(domainAllowsReject('cancelled'), false);
    assert.equal(domainAllowsReject('converted_to_shipment'), false);
    assert.throws(
      () => assertHqReviewTransition({ action: 'reject', currentStatus: 'approved' }),
      /已被其他人更新/,
    );
    assert.throws(
      () =>
        assertHqReviewTransition({
          action: 'approve',
          currentStatus: 'converted_to_shipment',
        }),
      /已被其他人更新/,
    );
    assert.throws(
      () => assertHqReviewTransition({ action: 'approve', currentStatus: 'cancelled' }),
      /已被其他人更新/,
    );
  });

  it('hides the review form after the request is finalized', () => {
    assert.equal(canShowHqRestockReviewForm('submitted', null), true);
    assert.equal(canShowHqRestockReviewForm('approved', null), true);
    assert.equal(canShowHqRestockReviewForm('rejected', null), false);
    assert.equal(canShowHqRestockReviewForm('cancelled', null), false);
    assert.equal(canShowHqRestockReviewForm('converted_to_shipment', null), false);
    assert.equal(canShowHqRestockReviewForm('submitted', 'shp_1'), false);
    assert.equal(canShowHqRestockReviewForm('draft', null), false);
  });
});

describe('HQ restock review quantity validation', () => {
  it('requires integer approved quantities and rejects negatives', () => {
    assert.deepEqual(parseHqApprovedQuantity(3), { ok: true, value: 3 });
    assert.equal(parseHqApprovedQuantity(1.5).ok, false);
    assert.equal(parseHqApprovedQuantity('2.0').ok, false);
    assert.equal(parseHqApprovedQuantity(-1).ok, false);
    assert.equal(parseHqApprovedQuantity('-2').ok, false);
  });

  it('rejects extra, missing, or duplicate items when the request already has lines', () => {
    const existing = [
      { productId: 'p1', requestedQuantity: 4 },
      { productId: 'p2', requestedQuantity: 2 },
    ];
    assert.equal(
      buildHqItemApprovals({
        existingItems: existing,
        payload: [
          { productId: 'p1', approvedQuantity: 4 },
          { productId: 'p2', approvedQuantity: 1 },
          { productId: 'p3', approvedQuantity: 1 },
        ],
      }).ok,
      false,
    );
    assert.equal(
      buildHqItemApprovals({
        existingItems: existing,
        payload: [{ productId: 'p1', approvedQuantity: 4 }],
      }).ok,
      false,
    );
    assert.equal(
      buildHqItemApprovals({
        existingItems: existing,
        payload: [
          { productId: 'p1', approvedQuantity: 1 },
          { productId: 'p1', approvedQuantity: 2 },
          { productId: 'p2', approvedQuantity: 1 },
        ],
      }).ok,
      false,
    );
  });

  it('rejects approved quantity above the server requested quantity', () => {
    const result = buildHqItemApprovals({
      existingItems: [{ productId: 'p1', requestedQuantity: 3 }],
      payload: [{ productId: 'p1', approvedQuantity: 4 }],
    });
    assert.equal(result.ok, false);
  });

  it('uses server requested quantity, not a client override', () => {
    const result = buildHqItemApprovals({
      existingItems: [{ productId: 'p1', requestedQuantity: 6 }],
      payload: [{ productId: 'p1', approvedQuantity: 2 }],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.lines[0]?.requestedQuantity, 6);
      assert.equal(result.lines[0]?.approvedQuantity, 2);
    }
  });

  it('fail-closes approve when every approved quantity is 0', () => {
    assert.throws(
      () =>
        assertApproveHasPositiveQty([
          { productId: 'p1', requestedQuantity: 3, approvedQuantity: 0 },
        ]),
      /大於 0/,
    );
  });
});

describe('HQ restock review auth and form fields', () => {
  it('does not treat a POS merchant session as HQ review access', () => {
    assert.equal(
      canAccessHqRestockInbox({ hasHqSession: false, hasMerchantSession: true }),
      false,
    );
    assert.equal(
      canAccessHqRestockInbox({ hasHqSession: true, hasMerchantSession: true }),
      true,
    );
  });

  it('reads only requestId, note, arrival date, and approved quantities from the form', () => {
    const formData = new FormData();
    formData.set('requestId', 'req_1');
    formData.set('hqNote', 'ok');
    formData.set('expectedArrivalDate', '2026-09-01');
    formData.set('merchantId', 'forged-merchant');
    formData.set('status', 'converted_to_shipment');
    formData.set('approvedBy', 'forged-user');
    formData.set('userId', 'forged-user');
    formData.append('productId', 'p1');
    formData.append('approvedQuantity', '2');
    formData.append('requestedQuantity', '99');
    const fields = readHqReviewFormFields(formData);
    assert.equal(fields.requestId, 'req_1');
    assert.deepEqual(fields.items, [{ productId: 'p1', approvedQuantity: '2' }]);
    assert.equal('merchantId' in fields, false);
    assert.equal('status' in fields, false);
    assert.equal('approvedBy' in fields, false);
  });

  it('requires a reject reason in the existing hqNote field', () => {
    assert.throws(() => parseHqRejectNote('  '), /拒絕原因/);
    assert.equal(parseHqRejectNote('庫存不足'), '庫存不足');
  });

  it('treats updateMany count other than 1 as a conflict', () => {
    assert.equal(hqReviewClaimCountIsConflict(1), false);
    assert.equal(hqReviewClaimCountIsConflict(0), true);
    assert.equal(hqReviewClaimCountIsConflict(2), true);
  });
});

describe('merchant-visible restock progress labels', () => {
  it('covers every HQ status the shop can already see', () => {
    assert.equal(restockStatusLabelForMerchant('submitted'), '公司確認中');
    assert.equal(restockStatusLabelForMerchant('under_review'), '公司確認中');
    assert.equal(restockStatusLabelForMerchant('approved'), '已確認');
    assert.equal(restockStatusLabelForMerchant('rejected'), '需要調整');
    assert.equal(restockStatusLabelForMerchant('converted_to_shipment'), '備貨中');
    assert.equal(restockStatusLabelForMerchant('cancelled'), '已取消');
  });
});

describe('HQ restock review conflict copy', () => {
  it('uses a dedicated stale-page message', () => {
    assert.equal(RESTOCK_REVIEW_CONFLICT_MESSAGE, '這張申請已被其他人更新，請重新載入');
  });
});

describe('HQ restock review actor and view mode', () => {
  it('unauthenticated users cannot start HQ review', () => {
    assert.throws(() => requireHqReviewActor(null), /請先登入總部帳號/);
  });

  it('authorized HQ actor comes from the session, not the form', () => {
    assert.equal(requireHqReviewActor({ userId: 'hq_1' }), 'hq_1');
    const formData = new FormData();
    formData.set('approvedBy', 'forged');
    formData.set('userId', 'forged');
    const fields = readHqReviewFormFields(formData);
    assert.equal(requireHqReviewActor({ userId: 'hq_session' }), 'hq_session');
    assert.equal('approvedBy' in fields, false);
  });

  it('finalized requests only show the result, not a submit form', () => {
    assert.equal(hqRestockDetailViewMode('rejected', null), 'result');
    assert.equal(hqRestockDetailViewMode('cancelled', null), 'result');
    assert.equal(hqRestockDetailViewMode('converted_to_shipment', null), 'result');
    assert.equal(hqRestockDetailViewMode('submitted', 'shp_1'), 'result');
    assert.deepEqual(hqRestockAllowedActionLabels('rejected'), []);
    assert.equal(hqRestockDetailViewMode('submitted', null), 'review');
    assert.equal(hqRestockDetailViewMode('approved', null), 'convert');
  });

  it('compare-and-set where clauses do not accept a client status', () => {
    assert.deepEqual(hqReviewClaimWhere('reject').status.in, ['submitted', 'under_review']);
    assert.deepEqual(hqReviewClaimWhere('approve').status.in, [
      'submitted',
      'under_review',
      'approved',
    ]);
    assert.equal(hqReviewClaimWhere('save').shipmentId, null);
  });

  it('maps conflict errors separately from generic failures', () => {
    const mapped = hqReviewActionStateFromError(new RestockRequestConflictError());
    assert.equal(mapped.conflict, true);
    assert.equal(mapped.error, RESTOCK_REVIEW_CONFLICT_MESSAGE);
    const generic = hqReviewActionStateFromError(new Error('連線逾時'));
    assert.equal(generic.conflict, undefined);
    assert.equal(generic.error, '連線逾時');
  });

  it('requires an arrival date only when approving', () => {
    assert.equal(parseHqExpectedArrivalDate('', false), null);
    assert.throws(() => parseHqExpectedArrivalDate('', true), /預計到貨日/);
  });
});
