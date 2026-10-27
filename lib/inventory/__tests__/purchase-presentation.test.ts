import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatPurchaseMoney, formatPurchaseDate, formatPurchaseTime, purchaseLineReceived } from '../purchase-presentation';

test('purchase costs show every cent including fractional shared shipping', () => {
  assert.match(formatPurchaseMoney(0.4), /0\.40$/);
  assert.match(formatPurchaseMoney(101.02), /101\.02$/);
  assert.match(formatPurchaseMoney(0), /0\.00$/);
});
test('purchase dates and timestamps use Taiwan even across UTC midnight', () => {
  const stamp = new Date('2026-10-25T23:16:00Z');
  assert.equal(formatPurchaseDate(stamp),'2026-10-26');
  assert.match(formatPurchaseTime(stamp), /2026\/10\/26.*07:16/);
});
test('partial receiving progress merges legacy and new receipts without double counting', () => {
  const line = {id:'line-a',productId:'product-a'};
  const first = {id:'r1',purchaseOrderId:null,items:[{productId:'product-a',sourceOrderItemId:'line-a',quantityGrams:400}]};
  assert.equal(purchaseLineReceived('order-a',line,[first,first]),400);
  const legacy = {id:'r2',purchaseOrderId:'order-a',items:[{productId:'product-a',sourceOrderItemId:null,quantityGrams:600}]};
  assert.equal(purchaseLineReceived('order-a',line,[first,legacy,legacy]),1000);
  assert.equal(purchaseLineReceived('order-b',line,[legacy]),0);
  assert.equal(purchaseLineReceived('order-a',{id:'line-b',productId:'product-b'},[first,legacy]),0);
});
