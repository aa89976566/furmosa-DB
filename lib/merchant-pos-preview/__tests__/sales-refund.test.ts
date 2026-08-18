import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { NEXT_PERIOD_NOTE, REQUEST_REFUND } from '../copy';
import { SALES } from '../fixtures';
import { visibleSales } from '../selectors';
import { createSession, requestDemoRefund } from '../session';

describe('merchant POS preview sales and refunds', () => {
  it('shows four refund states and only a merchant request action', () => {
    const statuses = SALES.map((sale) => sale.refund?.status ?? 'none');
    assert.ok(statuses.includes('none'));
    assert.ok(statuses.includes('requested'));
    assert.ok(statuses.includes('approved'));
    assert.ok(statuses.includes('rejected'));
    assert.ok(statuses.includes('completed'));

    const completed = SALES.find((sale) => sale.refund?.status === 'completed');
    assert.equal(completed?.refund?.nextPeriodNote, NEXT_PERIOD_NOTE);

    const src = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/sales-panel.tsx'),
      'utf8',
    );
    assert.match(src, /REQUEST_REFUND/);
    assert.equal(REQUEST_REFUND, '申請退款（示意）');
    assert.equal(src.includes('核准退款'), false);
    assert.equal(src.includes('完成退款'), false);
    assert.equal(src.includes('approveRefund'), false);
    assert.equal(src.includes('completeRefund'), false);
  });

  it('dedupes a local requested refund', () => {
    let session = createSession();
    session = requestDemoRefund(session, 'sale-cash-open');
    const first = visibleSales(session).find((sale) => sale.saleId === 'sale-cash-open');
    assert.equal(first?.refund?.status, 'requested');
    assert.equal(first?.canMerchantRequestRefund, false);

    const again = requestDemoRefund(session, 'sale-cash-open');
    assert.match(again.refundNotice ?? '', /不能重複送出/);
    assert.equal(Object.keys(again.localRefunds).length, 1);
  });
});
