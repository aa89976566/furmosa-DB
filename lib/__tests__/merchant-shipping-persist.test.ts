import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMerchantShippingFromForm } from '../merchant-shipping-persist';

describe('parseMerchantShippingFromForm', () => {
  it('preserves both 7-11 and door-to-door details', () => {
    const form = new FormData();
    form.set('preferredCarrier', '7-11');
    form.set('pickupStoreName', '新育商門市');
    form.set('address', '台北市松山區寧安街5巷10號1樓');

    assert.deepEqual(parseMerchantShippingFromForm(form), {
      preferredCarrier: '7-11',
      pickupStoreName: '新育商門市',
      address: '台北市松山區寧安街5巷10號1樓',
    });
  });

  it('requires the address when door-to-door is the default', () => {
    const form = new FormData();
    form.set('preferredCarrier', '送貨');
    form.set('pickupStoreName', '新育商門市');

    assert.equal(parseMerchantShippingFromForm(form).error, '請填寫送貨地址');
  });
});
