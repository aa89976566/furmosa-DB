import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildOrderCreateInitial, buildOrderEditInitial } from '@/lib/orders/build-edit-initial';

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

describe('buildOrderCreateInitial', () => {
  it('copies order fields, resets payment and reprices editable products from the current catalog', () => {
    const order = {
      id: 'order-1', orderNumber: 'ORD-1', source: 'website', merchantId: null,
      customerId: 'customer-1', discount: 20, shippingFeeType: 'prepaid',
      paymentStatus: 'paid', shippingMethod: 'convenience', cvsBrand: '711',
      cvsStoreName: '品晶門市', shippingAddress: '台北市', note: '原備註', status: 'completed',
      subscriptionId: null,
      items: [{ id: 'item-1', productId: 'product-1', weightGrams: 50, unit: '包',
        quantity: 2, unitPrice: 100, unitCost: null, isGift: false }],
    };
    const shipment = { recipientName: '歐欣宜', recipientPhone: '0988077682', recipientAddress: '台北市' };
    const products = [{ id: 'product-1', productCategory: 'STANDARD', unit: '包', price: 135,
      cost: 40, merchantSuggestedPrice: null, wholesalePrices: [],
      priceTiers: [{ id: 'tier-50', weightGrams: 50, unit: '包', price: 150, cost: 45 }] }];

    const result = buildOrderCreateInitial(order as never, shipment as never, products as never);

    assert.equal('orderId' in result, false);
    assert.equal(result.customerId, 'customer-1');
    assert.equal(result.recipientName, '歐欣宜');
    assert.equal(result.paymentStatus, 'unpaid');
    assert.equal(result.items[0]?.quantity, 2);
    assert.equal(result.items[0]?.unitPrice, 150);
    assert.equal(result.items[0]?.unitCost, 45);
  });

  it('copies every quantity and resolves a historical item by its saved SKU before productId', () => {
    const order = {
      id: 'order-2', orderNumber: 'ORD-2', source: 'website', merchantId: null,
      customerId: 'customer-1', discount: 0, shippingFeeType: 'free',
      paymentStatus: 'paid', shippingMethod: 'home', cvsBrand: null,
      cvsStoreName: null, shippingAddress: '台北市', note: null, status: 'completed',
      subscriptionId: null,
      items: [{
        id: 'item-2', productId: 'stale-product-id', productName: '原味雞霸', sku: 'FUR-0002',
        weightGrams: null, unit: null, quantity: 6, unitPrice: 89, unitCost: null, isGift: false,
      }],
    };
    const products = [
      {
        id: 'stale-product-id', name: '雞排', sku: 'FUR-OTHER', productCategory: 'STANDARD',
        unit: '片', price: 100, cost: 50, merchantSuggestedPrice: null, wholesalePrices: [],
        priceTiers: [],
      },
      {
        id: 'original-product-id', name: '原味雞霸', sku: 'fur-0002', productCategory: 'STANDARD',
        unit: '片', price: 89, cost: 40, merchantSuggestedPrice: null, wholesalePrices: [],
        priceTiers: [],
      },
    ];

    const result = buildOrderCreateInitial(order as never, null, products as never);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.productId, 'original-product-id');
    assert.equal(result.items[0]?.quantity, 6);
    assert.equal(result.items[0]?.unitPrice, 89);
  });
});
