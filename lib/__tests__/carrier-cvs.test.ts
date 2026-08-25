import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  has711PickupInfo,
  hasConveniencePickupReady,
  tryResolve711PickupFromForm,
} from '../carrier-cvs';

describe('tryResolve711PickupFromForm', () => {
  it('returns pickup info when all fields present', () => {
    const fd = new FormData();
    fd.set('pickupStore', '淡水復興門市');
    fd.set('pickupName', '阿木');
    fd.set('pickupPhone', '0912345678');

    const result = tryResolve711PickupFromForm(fd, '7-11');
    assert.deepEqual(result, {
      recipientName: '阿木',
      recipientPhone: '0912345678',
      recipientAddress: '7-11 · 淡水復興門市',
    });
  });

  it('returns null when 7-11 fields are incomplete instead of throwing', () => {
    const fd = new FormData();
    fd.set('pickupStore', '');
    fd.set('pickupName', '');
    fd.set('pickupPhone', '');

    assert.equal(tryResolve711PickupFromForm(fd, '7-11'), null);
  });

  it('returns null for non-711 carrier', () => {
    const fd = new FormData();
    fd.set('pickupStore', 'x');
    fd.set('pickupName', 'y');
    fd.set('pickupPhone', 'z');
    assert.equal(tryResolve711PickupFromForm(fd, '黑貓'), null);
  });
});

describe('has711PickupInfo', () => {
  it('accepts shipment that already has 7-11 pickup details', () => {
    assert.equal(
      has711PickupInfo({
        carrier: '7-11',
        recipientName: '阿木',
        recipientPhone: '0912345678',
        recipientAddress: '7-11 · 淡水復興門市',
      }),
      true,
    );
  });
});

describe('hasConveniencePickupReady', () => {
  it('allows non-convenience orders', () => {
    assert.equal(
      hasConveniencePickupReady({
        order: { shippingMethod: 'home' },
      }),
      true,
    );
  });

  it('allows convenience when brand and store name exist without region', () => {
    assert.equal(
      hasConveniencePickupReady({
        order: {
          shippingMethod: 'convenience',
          cvsBrand: '711',
          cvsStoreName: '薇閣門市',
          shippingAddress: null,
        },
      }),
      true,
    );
  });

  it('allows convenience when shipment already has 7-11 pickup', () => {
    assert.equal(
      hasConveniencePickupReady({
        order: {
          shippingMethod: 'convenience',
          cvsBrand: null,
          cvsStoreName: null,
          shippingAddress: null,
        },
        shipment: {
          carrier: '7-11',
          recipientName: '李宏需',
          recipientPhone: '0932661030',
          recipientAddress: '7-11 · 薇閣門市',
        },
      }),
      true,
    );
  });

  it('blocks convenience when neither order nor shipment has store info', () => {
    assert.equal(
      hasConveniencePickupReady({
        order: {
          shippingMethod: 'convenience',
          cvsBrand: null,
          cvsStoreName: null,
          shippingAddress: null,
        },
        shipment: {
          carrier: null,
          recipientName: '李宏需',
          recipientPhone: '0932661030',
          recipientAddress: null,
        },
      }),
      false,
    );
  });
});
