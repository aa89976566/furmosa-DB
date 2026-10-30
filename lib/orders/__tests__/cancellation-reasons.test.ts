import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isOrderCancellationReasonCode,
  orderCancellationReasonLabel,
  parseOrderCancellationRecord,
} from '../cancellation-reasons';

describe('order cancellation records', () => {
  it('accepts the controlled reason list and labels it', () => {
    assert.equal(isOrderCancellationReasonCode('customer_request'), true);
    assert.equal(isOrderCancellationReasonCode('free_text'), false);
    assert.equal(orderCancellationReasonLabel('out_of_stock'), '商品缺貨');
  });

  it('parses safe audit metadata and ignores invalid JSON', () => {
    assert.deepEqual(parseOrderCancellationRecord(JSON.stringify({
      reasonCode: 'customer_request',
      reasonLabel: '客戶要求取消',
      note: '電話確認',
      actorName: 'CC',
    })), {
      reasonCode: 'customer_request',
      reasonLabel: '客戶要求取消',
      note: '電話確認',
      actorName: 'CC',
    });
    assert.equal(parseOrderCancellationRecord('{'), null);
  });
});
