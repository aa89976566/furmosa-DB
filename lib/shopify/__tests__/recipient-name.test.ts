import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeStoredShopifyRecipient,
  shopifyRecipientName,
} from '../recipient-name';
import { snapshotView } from '../snapshot-view';

const snapshot = {
  schemaVersion: 1,
  order: {
    shipping_address: { name: '芳瑜 高', first_name: '芳瑜', last_name: '高' },
    customer: { first_name: '芳瑜', last_name: '高' },
  },
};

test('中文 Shopify 姓名顯示為姓＋名且不加西式空格', () => {
  assert.equal(shopifyRecipientName(snapshot), '高芳瑜');
  assert.equal(snapshotView(snapshot)?.recipient, '高芳瑜');
});

test('英文姓名同樣姓在前並保留空格', () => {
  assert.equal(
    shopifyRecipientName({ order: { shipping_address: { first_name: 'Ming', last_name: 'Chen' } } }),
    'Chen Ming',
  );
});

test('舊 Shopify 名＋姓快照會修正，人工姓名不會被翻轉', () => {
  assert.equal(normalizeStoredShopifyRecipient('芳瑜 高', snapshot), '高芳瑜');
  assert.equal(normalizeStoredShopifyRecipient('芳瑜高', snapshot), '高芳瑜');
  assert.equal(normalizeStoredShopifyRecipient('客服人工修正', snapshot), '客服人工修正');
});
