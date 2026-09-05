import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildOrderEditInitial } from '@/lib/orders/build-edit-initial';

describe('buildOrderEditInitial', () => {
  it('fills a missing historical weight and unit from the resolved product tier', () => {
    const order = {
      id: 'order-1',
      orderNumber: 'ORD-1',
      source: 'consignment',
      merchantId: 'merchant-1',
      customerId: null,
      discount: 0,
      shippingFeeType: 'free',
      paymentStatus: 'unpaid',
      shippingMethod: 'delivery',
      cvsBrand: null,
      cvsStoreName: null,
      shippingAddress: null,
      note: null,
      status: 'confirmed',
      subscriptionId: null,
      items: [{
        id: 'item-1',
        productId: 'product-1',
        weightGrams: null,
        unit: null,
        quantity: 1,
        unitPrice: 0,
        unitCost: null,
        isGift: false,
      }],
    };
    const products = [{
      id: 'product-1',
      productCategory: 'JAR_EXCHANGE',
      unit: 'g',
      priceTiers: [{ id: 'tier-15', weightGrams: 15, unit: 'g' }],
    }];

    const result = buildOrderEditInitial(order as never, null, products as never);

    assert.equal(result.items[0]?.tierId, 'tier-15');
    assert.equal(result.items[0]?.weightGrams, 15);
    assert.equal(result.items[0]?.unit, 'g');
    assert.equal(result.items[0]?.unitPrice, 0);
  });
});
