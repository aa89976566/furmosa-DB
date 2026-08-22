import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRefillFulfillment } from '@/lib/refill/fulfillment-calculator';

describe('refill fulfillment pricing', () => {
  it('領 1、還 1：一罐換罐價，不需補款', () => {
    assert.deepEqual(
      calculateRefillFulfillment({
        pickupQuantity: 1,
        returnedQuantity: 1,
        availablePrepaidAmount: 99,
      }),
      {
        pickupQuantity: 1,
        returnedQuantity: 1,
        exchangeQuantity: 1,
        originalPriceQuantity: 0,
        extraReturnQuantity: 0,
        finalAmount: 99,
        prepaidAmount: 99,
        topUpAmount: 0,
      },
    );
  });

  it('領 1、還 2：多的一個只算額外回收，不增加折扣', () => {
    const result = calculateRefillFulfillment({
      pickupQuantity: 1,
      returnedQuantity: 2,
      availablePrepaidAmount: 99,
    });
    assert.equal(result.exchangeQuantity, 1);
    assert.equal(result.extraReturnQuantity, 1);
    assert.equal(result.finalAmount, 99);
    assert.equal(result.topUpAmount, 0);
  });

  it('領 2、只還 1：一罐換罐價、一罐原價，需補 NT$30', () => {
    const result = calculateRefillFulfillment({
      pickupQuantity: 2,
      returnedQuantity: 1,
      availablePrepaidAmount: 198,
    });
    assert.equal(result.exchangeQuantity, 1);
    assert.equal(result.originalPriceQuantity, 1);
    assert.equal(result.finalAmount, 228);
    assert.equal(result.topUpAmount, 30);
  });

  it('領 2、都沒還：兩罐原價，需補 NT$60', () => {
    const result = calculateRefillFulfillment({
      pickupQuantity: 2,
      returnedQuantity: 0,
      availablePrepaidAmount: 198,
    });
    assert.equal(result.exchangeQuantity, 0);
    assert.equal(result.originalPriceQuantity, 2);
    assert.equal(result.finalAmount, 258);
    assert.equal(result.topUpAmount, 60);
  });
});
