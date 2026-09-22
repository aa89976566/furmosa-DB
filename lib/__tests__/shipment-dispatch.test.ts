import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildFulfillmentTimeline,
  canMarkHandedOver,
  dispatchAction,
  isValidTrackingNumber,
  orderStatusChangeError,
} from '@/lib/shipment-dispatch';

describe('交寄與寄件單必須分開', () => {
  it('沒有有效單號時只顯示建立寄件單，不會直接確認已交寄', () => {
    assert.deepEqual(
      dispatchAction({ status: 'pending', shippingMethod: 'convenience', cvsBrand: '711' }),
      { type: 'create-label', label: '建立 7-11 寄件單' },
    );
    assert.deepEqual(
      dispatchAction({ status: 'pending', carrier: '黑貓', shippingMethod: 'home' }),
      { type: 'create-label', label: '建立黑貓託運單' },
    );
    assert.equal(isValidTrackingNumber('0000'), false);
    assert.equal(isValidTrackingNumber('123'), false);
    assert.equal(isValidTrackingNumber('TW12345678'), true);
  });

  it('有有效單號才改顯示確認已交寄，已交寄後不再提供可重複送出的按鈕', () => {
    assert.equal(
      dispatchAction({
        status: 'packed',
        carrier: '黑貓',
        trackingNumber: 'TW12345678',
      }).type,
      'confirm-handoff',
    );
    assert.equal(
      dispatchAction({ status: 'shipped', carrier: '黑貓', trackingNumber: 'TW12345678' }).type,
      'hidden',
    );
    assert.equal(canMarkHandedOver({ trackingNumber: null, explicitHandoff: false }), false);
    assert.equal(canMarkHandedOver({ trackingNumber: 'TW12345678', explicitHandoff: false }), true);
    assert.equal(canMarkHandedOver({ trackingNumber: null, explicitHandoff: true }), true);
  });

  it('訂單頁不能把未交寄直接改成已出貨，退回必須有權限、確認與原因', () => {
    assert.match(
      orderStatusChangeError({
        role: 'staff',
        current: 'confirmed',
        next: 'shipped',
        reason: '',
        confirmed: false,
      }) ?? '',
      /不會在這裡自動標記/,
    );
    assert.match(
      orderStatusChangeError({
        role: 'warehouse',
        current: 'confirmed',
        next: 'cancelled',
        reason: '客人取消',
        confirmed: true,
      }) ?? '',
      /沒有取消或退回/,
    );
    assert.equal(
      orderStatusChangeError({
        role: 'staff',
        current: 'packed',
        next: 'confirmed',
        reason: '地址需重填',
        confirmed: true,
      }),
      null,
    );
    assert.match(
      orderStatusChangeError({
        role: 'staff',
        current: 'packed',
        next: 'confirmed',
        reason: '',
        confirmed: true,
      }) ?? '',
      /填寫原因/,
    );
  });

  it('時間軸分開付款、備貨、寄件單、已交寄與送達', () => {
    const steps = buildFulfillmentTimeline({
      paymentStatus: 'paid',
      orderedAt: new Date('2026-09-01T00:00:00Z'),
      orderStatus: 'confirmed',
      shipmentStatus: 'pending',
      trackingNumber: null,
    });
    assert.deepEqual(
      steps.map((step) => [step.label, step.done]),
      [
        ['付款', true],
        ['備貨', false],
        ['建立寄件單', false],
        ['已交寄', false],
        ['送達', false],
      ],
    );
    const handed = buildFulfillmentTimeline({
      paymentStatus: 'paid',
      orderedAt: new Date('2026-09-01T00:00:00Z'),
      orderStatus: 'shipped',
      shipmentStatus: 'shipped',
      packedAt: new Date('2026-09-02T00:00:00Z'),
      shippedAt: new Date('2026-09-03T00:00:00Z'),
      trackingNumber: 'TW12345678',
    });
    assert.equal(handed.find((step) => step.key === 'label')?.done, true);
    assert.equal(handed.find((step) => step.key === 'handed')?.done, true);
    assert.equal(handed.find((step) => step.key === 'delivered')?.done, false);
  });
});
