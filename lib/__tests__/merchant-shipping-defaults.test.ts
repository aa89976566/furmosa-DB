import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  merchantShippingToOrderFields,
  parse711StoreFromAddress,
  profileDefaults,
} from '@/lib/merchant-shipping-defaults';
import { parseMerchantShippingFromForm } from '@/lib/merchant-shipping-persist';
import { isSameCvsDestination } from '@/lib/logistics-display';

describe('merchantShippingToOrderFields 7-11', () => {
  it('門市與 shippingAddress 同源，不沿用舊街址', () => {
    const fields = merchantShippingToOrderFields({
      name: '測試店',
      contactName: '黃昊倫',
      phone: '0909226587',
      preferredCarrier: '7-11',
      pickupStoreName: '民大門市',
      address: '桃園市中壢區舊街址 1 號',
      city: '桃園',
    });

    assert.equal(fields.shippingMethod, 'convenience');
    assert.equal(fields.cvsStoreName, '民大門市');
    assert.equal(fields.shippingAddress, '7-11 · 民大門市');
  });

  it('profileDefaults 不以舊街址充當 7-11 門市名', () => {
    const d = profileDefaults({
      name: '測試店',
      preferredCarrier: '7-11',
      pickupStoreName: '民大門市',
      address: '桃園市中壢區舊街址 1 號',
      city: '桃園',
    });
    assert.equal(d.pickupStore, '民大門市');
  });
});

describe('parseMerchantShippingFromForm', () => {
  it('選 7-11 時 address 寫成門市顯示字串', () => {
    const fd = new FormData();
    fd.set('preferredCarrier', '7-11');
    fd.set('pickupStoreName', '民大門市');
    fd.set('address', '桃園市舊地址');
    const parsed = parseMerchantShippingFromForm(fd);
    assert.equal(parsed.error, undefined);
    assert.equal(parsed.pickupStoreName, '民大門市');
    assert.equal(parsed.address, '7-11 · 民大門市');
  });

  it('選送貨時清除門市並要求地址', () => {
    const fd = new FormData();
    fd.set('preferredCarrier', '送貨');
    fd.set('pickupStoreName', '民大門市');
    fd.set('address', '桃園市中壢區送貨路 2 號');
    const parsed = parseMerchantShippingFromForm(fd);
    assert.equal(parsed.pickupStoreName, null);
    assert.equal(parsed.address, '桃園市中壢區送貨路 2 號');
  });
});

describe('isSameCvsDestination', () => {
  it('7-11 格式地址與門市名稱視為相同', () => {
    assert.equal(
      isSameCvsDestination('7-ELEVEN · 民大門市', '民大門市', '7-11 · 民大門市'),
      true,
    );
  });

  it('不同街址則視為不同', () => {
    assert.equal(
      isSameCvsDestination('7-ELEVEN · 民大門市', '民大門市', '桃園市中壢區舊街址 1 號'),
      false,
    );
  });
});

describe('parse711StoreFromAddress', () => {
  it('可從顯示地址還原門市名', () => {
    assert.equal(parse711StoreFromAddress('7-11 · 民大門市'), '民大門市');
  });
});
