import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inventoryPriceLabel } from '../inventory-price';
test('retail prices follow active tier prices and preserve exact single prices',()=>{
 assert.equal(inventoryPriceLabel({price:275,tiers:[{price:275}]}),'NT$275');
 assert.equal(inventoryPriceLabel({price:285,tiers:[{price:285}]}),'NT$285');
 assert.equal(inventoryPriceLabel({price:90,tiers:[{price:90},{price:150},{price:1,status:'archived'}]}),'NT$90–150');
 assert.equal(inventoryPriceLabel({price:165}),'NT$165');
 assert.equal(inventoryPriceLabel({price:0}),'售價待確認');
 assert.equal(inventoryPriceLabel({price:50,tiers:[{price:20,status:'archived'}]}),'售價待確認');
 assert.equal(inventoryPriceLabel({tiers:[{price:NaN},{price:-1}]}),'售價待確認');
});

test('refill cards show first-jar and conditional exchange prices regardless of stored tier price', () => {
 const label = '首罐 NT$129／帶空罐換罐 NT$99';
 assert.equal(inventoryPriceLabel({productCategory:'JAR_EXCHANGE',price:99,tiers:[{price:99}]}),label);
 assert.equal(inventoryPriceLabel({productCategory:'JAR_EXCHANGE',price:129}),label);
 assert.equal(inventoryPriceLabel({productCategory:'STANDARD',price:99}), 'NT$99');
});
