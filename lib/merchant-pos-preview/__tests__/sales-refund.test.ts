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

    const src = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/sales-panel.tsx'),
      'utf8',
    );
    assert.match(src, /REQUEST_REFUND/);
    assert.equal(REQUEST_REFUND, '提出退款申請');
    assert.equal(src.includes('核准退款'), false);
    assert.equal(src.includes('完成退款'), false);
    assert.equal(src.includes('approveRefund'), false);
    assert.equal(src.includes('completeRefund'), false);
  });

  it('shows O1 restock and loss outcomes plus a locked next-period refund', () => {
    const restock = SALES.find((sale) => sale.saleId === 'sale-o1-restock')?.refund;
    const loss = SALES.find((sale) => sale.saleId === 'sale-o1-loss')?.refund;
    const settled = SALES.find((sale) => sale.saleId === 'sale-refund-completed')?.refund;
    assert.equal(restock?.status, 'completed');
    assert.equal(restock?.inventoryDisposition, 'restock_sellable');
    assert.equal(restock?.sellableStockReturned, true);
    assert.match(restock?.conditionLabel ?? '', /未拆封/);
    assert.equal(restock?.settledInLockedPeriod, false);

    assert.equal(loss?.status, 'completed');
    assert.equal(loss?.inventoryDisposition, 'loss_unsellable');
    assert.equal(loss?.sellableStockReturned, false);
    assert.match(loss?.lossReason ?? '', /受潮|破損|拆封/);

    assert.equal(settled?.settledInLockedPeriod, true);
    assert.equal(settled?.nextPeriodNote, NEXT_PERIOD_NOTE);
    assert.match(settled?.commissionNote ?? '', /下期/);
  });

  it('dedupes a local requested refund', () => {
    let session = createSession();
    session = requestDemoRefund(session, 'sale-cash-open', {
      condition: 'unsellable',
      reason: '顧客反映商品變質',
      lossReason: '內容受潮，不可再販售',
    });
    const first = visibleSales(session).find((sale) => sale.saleId === 'sale-cash-open');
    assert.equal(first?.refund?.status, 'requested');
    assert.equal(first?.canMerchantRequestRefund, false);

    assert.equal(session.localRefunds['sale-cash-open']?.condition, 'unsellable');
    assert.equal(session.localRefunds['sale-cash-open']?.lossReason, '內容受潮，不可再販售');
    assert.match(first?.refund?.inventoryNote ?? '', /不加回可售庫存/);

    const again = requestDemoRefund(session, 'sale-cash-open', {
      condition: 'sellable_unopened',
      reason: '重複申請',
      lossReason: null,
    });
    assert.match(again.refundNotice ?? '', /不能重複送出/);
    assert.equal(Object.keys(again.localRefunds).length, 1);
  });
});
