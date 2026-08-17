import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { APP_STATUS, PAYMENT_STATUS } from '../constants';
import { decideJibaApproveTransition } from '../payment';
import { activeShipmentQueueWhere } from '@/lib/shipment-queue-filters';

/**
 * 重現：PENDING_REVIEW → approve（已申報或未申報）→ 出貨列表 where 可查到。
 * 決策與 query 皆為純資料，不碰正式 DB。
 */
describe('PENDING_REVIEW approve appears in shipment list', () => {
  it('queued approve uses order status that shipment list does not hide', () => {
    const decision = decideJibaApproveTransition({
      status: APP_STATUS.PENDING_REVIEW,
      paymentStatus: PAYMENT_STATUS.DECLARED,
      collected: { declaredPaidAt: '2026-08-17T02:00:00.000Z' },
    });
    assert.equal(decision.action, 'queue');
    if (decision.action !== 'queue') return;

    const order = { status: decision.nextOrderStatus };
    const shipment = { status: 'pending', orderId: 'ord_1', order };
    const where = activeShipmentQueueWhere;
    assert.deepEqual(where.status, { in: ['pending', 'packed', 'shipped'] });
    const hidden = where.OR;
    assert.ok(Array.isArray(hidden));
    const orderClause = hidden.find(
      (item) => item && typeof item === 'object' && 'order' in item,
    ) as { order?: { status?: { notIn?: string[] } } };
    assert.ok(orderClause?.order?.status?.notIn?.includes('cancelled'));
    assert.equal(orderClause?.order?.status?.notIn?.includes(order.status), false);
    assert.equal(shipment.status, 'pending');
  });

  it('unpaid approve still creates a pending shipment visible in the list', () => {
    const decision = decideJibaApproveTransition({
      status: APP_STATUS.PENDING_REVIEW,
      paymentStatus: PAYMENT_STATUS.UNPAID,
    });
    assert.equal(decision.action, 'await_payment');
    if (decision.action !== 'await_payment') return;

    assert.equal(decision.createShipment, true);
    assert.equal(decision.nextAppStatus, APP_STATUS.AWAITING_SHIPPING_PAYMENT);
    const order = { status: decision.nextOrderStatus };
    const where = activeShipmentQueueWhere;
    const hidden = where.OR;
    assert.ok(Array.isArray(hidden));
    const orderClause = hidden.find(
      (item) => item && typeof item === 'object' && 'order' in item,
    ) as { order?: { status?: { notIn?: string[] } } };
    assert.ok(orderClause?.order?.status?.notIn?.includes('cancelled'));
    assert.equal(orderClause?.order?.status?.notIn?.includes(order.status), false);
  });

  it('approve service writes inside a transaction and is idempotent', () => {
    const src = readFileSync(new URL('../service.ts', import.meta.url), 'utf8');
    assert.match(src, /prisma\.\$transaction/);
    assert.match(src, /updateMany/);
    assert.match(src, /decideJibaApproveTransition/);
    assert.match(src, /ensureQueuedShipment/);
    assert.match(src, /declareJibaShippingPayment/);
    assert.doesNotMatch(src, /paymentStatus:\s*'paid'/);
  });
});
