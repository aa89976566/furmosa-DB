import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { JIBA_SHIPPING_FEE, PAYMENT_STATUS } from '../constants';
import { resolveShipmentFulfillmentFee } from '../shipment-charge';

describe('resolveShipmentFulfillmentFee', () => {
  it('uses jiba charge labels instead of 包郵', () => {
    const awaiting = resolveShipmentFulfillmentFee({
      orderStatus: 'awaiting_shipping_payment',
      shippingFeeType: 'free',
      jiba: { paymentStatus: PAYMENT_STATUS.UNPAID, collectedDataJson: '{}' },
    });
    assert.equal(awaiting.isJiba, true);
    assert.equal(awaiting.fulfillmentFeeLabel, `物流處理費 ${JIBA_SHIPPING_FEE} 元｜待申報`);
    assert.equal(awaiting.paymentReviewHold, true);

    const declared = resolveShipmentFulfillmentFee({
      orderStatus: 'confirmed',
      shippingFeeType: 'free',
      jiba: {
        paymentStatus: PAYMENT_STATUS.DECLARED,
        collectedDataJson: '{"declaredPaidAt":"2026-08-17T01:00:00.000Z"}',
      },
    });
    assert.equal(declared.fulfillmentFeeLabel, `物流處理費 ${JIBA_SHIPPING_FEE} 元｜已申報待核帳`);
    assert.equal(declared.paymentReviewHold, true);

    const paid = resolveShipmentFulfillmentFee({
      orderStatus: 'confirmed',
      shippingFeeType: 'free',
      jiba: { paymentStatus: PAYMENT_STATUS.PAID, collectedDataJson: '{}' },
    });
    assert.equal(paid.fulfillmentFeeLabel, `物流處理費 ${JIBA_SHIPPING_FEE} 元｜已核帳`);
    assert.equal(paid.paymentReviewHold, false);

    const threshold = resolveShipmentFulfillmentFee({
      orderStatus: 'confirmed',
      shippingFeeType: 'free',
      jiba: { paymentStatus: PAYMENT_STATUS.UNPAID, collectedDataJson: '{"upsellAmount":399}' },
    });
    assert.equal(threshold.fulfillmentFeeLabel, '加購達門檻｜免運');
    assert.equal(threshold.paymentReviewHold, false);
  });

  it('keeps generic shippingFeeType labels for non-jiba orders', () => {
    const view = resolveShipmentFulfillmentFee({
      orderStatus: 'confirmed',
      shippingFeeType: 'free',
    });
    assert.equal(view.isJiba, false);
    assert.equal(view.fulfillmentFeeLabel, '包郵');
    assert.equal(view.paymentReviewHold, false);
  });
});
