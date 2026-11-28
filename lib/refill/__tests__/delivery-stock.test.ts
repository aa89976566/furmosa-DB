import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkRefillDeliveryStock } from '../delivery-stock';

const delivery = {
  requestedFlavourId: 'duck', deliveredFlavourId: 'duck', quantity: 1,
  onHand: 1, reservedForOthers: 0,
};

test('a preorder can pick up its own last reserved jar', () => {
  assert.equal(checkRefillDeliveryStock(delivery), null);
});

test('a different order cannot consume the last jar reserved by another preorder', () => {
  assert.equal(checkRefillDeliveryStock({
    ...delivery, requestedFlavourId: null, reservedForOthers: 1,
  }), 'STOCK_RESERVED');
});

test('legacy orders can use remaining unreserved stock', () => {
  assert.equal(checkRefillDeliveryStock({
    ...delivery, requestedFlavourId: null, onHand: 2, reservedForOthers: 1,
  }), null);
});

test('a preorder cannot substitute the flavour or take more than one jar', () => {
  assert.equal(checkRefillDeliveryStock({
    ...delivery, deliveredFlavourId: 'chicken',
  }), 'PREORDER_ITEM_MISMATCH');
  assert.equal(checkRefillDeliveryStock({
    ...delivery, quantity: 2, onHand: 2,
  }), 'PREORDER_ITEM_MISMATCH');
});
