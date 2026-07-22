import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveShipActionCarrierDefaults } from '../merchant-shipping-defaults';

describe('resolveShipActionCarrierDefaults', () => {
  it('prefers shipment recipient fields for 7-11', () => {
    const defaults = resolveShipActionCarrierDefaults({
      carrier: '7-11',
      recipientName: '阿木',
      recipientPhone: '0911111111',
      recipientAddress: '7-11 · 淡水中山門市',
      merchant: {
        name: '測試店',
        contactName: '店長',
        phone: '0922222222',
        preferredCarrier: '7-11',
        pickupStoreName: '其他門市',
      },
    });

    assert.equal(defaults.defaultCarrier, '7-11');
    assert.equal(defaults.pickupStore, '淡水中山門市');
    assert.equal(defaults.pickupName, '阿木');
    assert.equal(defaults.pickupPhone, '0911111111');
  });

  it('uses 送貨 and merchant street address for 柒沐-style delivery', () => {
    const defaults = resolveShipActionCarrierDefaults({
      carrier: null,
      recipientName: null,
      recipientPhone: null,
      recipientAddress: null,
      merchant: {
        name: '柒沐寵物美容',
        contactName: '柒沐聯絡人',
        phone: '02-2628-3589',
        preferredCarrier: '送貨',
        address: '新北市淡水區北新路218號',
        pickupStoreName: null,
      },
    });

    assert.equal(defaults.defaultCarrier, '送貨');
    assert.equal(defaults.pickupStore, '新北市淡水區北新路218號');
    assert.equal(defaults.pickupName, '柒沐聯絡人');
    assert.equal(defaults.pickupPhone, '02-2628-3589');
  });

  it('falls back to merchant profile when shipment pickup is empty', () => {
    const defaults = resolveShipActionCarrierDefaults({
      carrier: null,
      recipientName: null,
      recipientPhone: null,
      recipientAddress: null,
      merchant: {
        name: '測試店',
        contactName: '聯絡人',
        phone: '0933333333',
        preferredCarrier: '7-11',
        pickupStoreName: '淡水復興門市',
      },
    });

    assert.equal(defaults.defaultCarrier, '7-11');
    assert.equal(defaults.pickupStore, '淡水復興門市');
    assert.equal(defaults.pickupName, '聯絡人');
    assert.equal(defaults.pickupPhone, '0933333333');
  });
});
