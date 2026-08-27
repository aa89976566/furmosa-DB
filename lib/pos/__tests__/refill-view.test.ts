import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatRefillOrderNo,
  parseRefillLookupQuery,
  refillStaffView,
} from '@/lib/pos/refill-view';
import { mapRefillStaffError } from '@/lib/pos/refill-staff-errors';

describe('refill lookup parse', () => {
  it('normalizes spaces and dashes, then detects 8-digit serials', () => {
    assert.deepEqual(parseRefillLookupQuery('  3812 4491  '), {
      kind: 'serial',
      value: '38124491',
    });
    assert.equal(parseRefillLookupQuery('FRM-A3812').kind, 'unknown');
  });

  it('parses display order numbers and raw ids', () => {
    const display = parseRefillLookupQuery('rfp-240428-0012');
    assert.equal(display.kind, 'display');
    if (display.kind === 'display') {
      assert.equal(display.yymmdd, '240428');
      assert.equal(display.suffix, '0012');
    }
    const id = parseRefillLookupQuery('clxyzabcdefghijklmnopqrst');
    assert.equal(id.kind, 'id');
  });
});

describe('refill staff view', () => {
  it('keeps unpaid orders out of fulfillment', () => {
    const unpaid = refillStaffView({
      id: 'abc12345',
      status: 'payment_pending',
      paid: false,
      deliveryMode: 'exchange',
      createdAt: '2024-04-28T02:00:00.000Z',
    });
    assert.equal(unpaid.paymentLabel, '尚未付款');
    assert.equal(unpaid.canFulfill, false);
    assert.equal(unpaid.unpaidBlock, true);
    assert.match(unpaid.orderNo, /^#RFP-/);
  });

  it('labels exchange vs extra-paid first path', () => {
    const waiting = refillStaffView({
      id: 'order1xyz',
      status: 'paid_waiting_return',
      paid: true,
      deliveryMode: 'exchange',
    });
    assert.equal(waiting.paymentLabel, '已付款');
    assert.equal(waiting.progressLabel, '待帶空罐');
    assert.equal(waiting.skipOldJar, false);

    const verified = refillStaffView({
      id: 'order1xyz',
      status: 'old_container_verified',
      paid: true,
      deliveryMode: 'exchange',
    });
    assert.equal(verified.progressLabel, '等待交付');

    const extra = refillStaffView({
      id: 'order1xyz',
      status: 'paid_waiting_return',
      paid: true,
      deliveryMode: 'first',
      extraAmount: 30,
    });
    assert.equal(extra.paymentLabel, '已補差額');
    assert.equal(extra.skipOldJar, true);
    assert.equal(extra.progressLabel, '等待交付');
  });

  it('formats a stable display number from id + date', () => {
    assert.equal(
      formatRefillOrderNo('cuidxxxx0012', new Date(2024, 3, 28)),
      '#RFP-240428-0012',
    );
  });
});

describe('refill staff errors', () => {
  it('hides technical codes and other-store internals', () => {
    assert.equal(
      mapRefillStaffError({ code: 'WRONG_STORE', error: '這筆訂單只能在中和店領取。' }),
      '這筆換罐不是在本店領取',
    );
    assert.equal(
      mapRefillStaffError({ code: 'NO_OPEN_ORDER', error: '找不到' }, 'lookup'),
      '找不到這個罐子的換罐資料',
    );
    assert.equal(
      mapRefillStaffError({ code: 'SERIAL_NOT_OWNED', error: '這個序號不屬於這位會員。' }, 'old'),
      '這個罐子不能用於這筆換罐',
    );
    assert.equal(
      mapRefillStaffError({ code: 'SERIAL_USED', error: '這個序號已經使用過。' }, 'new'),
      '這個新罐目前不能交付',
    );
    assert.equal(
      mapRefillStaffError({ error: 'P2002 Prisma Unauthorized' }, 'complete'),
      '這筆換罐目前不能完成，請重新整理後再試一次',
    );
  });
});
