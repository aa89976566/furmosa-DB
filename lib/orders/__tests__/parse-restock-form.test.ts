import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseRestockShippingFromForm,
  shippingMethodFromCarrier,
} from '../parse-restock-form';

describe('shippingMethodFromCarrier', () => {
  it('maps 7-11 to convenience', () => {
    assert.equal(shippingMethodFromCarrier('7-11'), 'convenience');
  });

  it('maps 黑貓 to home', () => {
    assert.equal(shippingMethodFromCarrier('黑貓'), 'home');
  });

  it('maps 送貨 to delivery', () => {
    assert.equal(shippingMethodFromCarrier('送貨'), 'delivery');
  });
});

describe('parseRestockShippingFromForm', () => {
  it('reads payment and shipping fee fields', () => {
    const fd = new FormData();
    fd.set('shippingFeeType', 'free');
    fd.set('paymentStatus', 'paid');
    fd.set('shippingMethod', 'convenience');
    fd.set('discount', '0');

    const parsed = parseRestockShippingFromForm(fd, '7-11');
    assert.equal(parsed.shippingFeeType, 'free');
    assert.equal(parsed.paymentStatus, 'paid');
    assert.equal(parsed.shippingMethod, 'convenience');
    assert.equal(parsed.shippingFee, 0);
    assert.equal(parsed.companyShippingCost, 60);
  });
});
