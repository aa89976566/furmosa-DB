import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { verifyAppProxyQuery } from '../app-proxy-signature';

const config = { appSecret: 'fixture-only-not-a-live-key', expectedShop: 'fixture-shop.myshopify.com', nowSeconds: 1700000000 };
function signed(extra = '', timestamp = '1700000000') {
  const query = `shop=fixture-shop.myshopify.com&timestamp=${timestamp}&path_prefix=%2Fapps%2Fpickup&logged_in_customer_id=&q=%E4%BF%A1%E7%BE%A9${extra}`;
  // Independent reference implementation for the documented grouped/sorted format.
  const p = new URLSearchParams(query);
  const keys = Array.from(new Set(p.keys()));
  const message = keys.map(k => k + '=' + p.getAll(k).join(',')).sort().join('');
  return query + '&signature=' + createHmac('sha256', config.appSecret).update(message).digest('hex');
}
test('guest storefront request needs no HQ/customer login and preserves signed extra fields', () => {
  assert.equal(verifyAppProxyQuery(signed('&extra=1&extra=2'), config), true);
});
test('changed query, wrong shop and wrong application key fail', () => {
  assert.equal(verifyAppProxyQuery(signed() + '&storeId=001', config), false);
  assert.equal(verifyAppProxyQuery(signed(), { ...config, expectedShop: 'other.myshopify.com' }), false);
  assert.equal(verifyAppProxyQuery(signed(), { ...config, appSecret: 'wrong' }), false);
});
test('expired and future timestamps fail; allowed clock skew succeeds', () => {
  assert.equal(verifyAppProxyQuery(signed('', '1699999699'), config), false);
  assert.equal(verifyAppProxyQuery(signed('', '1700000031'), config), false);
  assert.equal(verifyAppProxyQuery(signed('', '1700000020'), config), true);
});
test('duplicate security fields and application arguments fail even if signed', () => {
  for (const suffix of ['&shop=fixture-shop.myshopify.com', '&timestamp=1700000000', '&q=other', '&storeId=001&storeId=002', '&temperature=ambient&temperature=frozen']) {
    assert.equal(verifyAppProxyQuery(signed(suffix), config), false);
  }
  assert.equal(verifyAppProxyQuery(signed() + '&signature=' + '0'.repeat(64), config), false);
});
test('malformed, missing and oversized inputs fail without throwing', () => {
  for (const query of ['', 'signature=zz', signed().replace(/signature=.*/, 'signature=0'), 'a'.repeat(8193)]) {
    assert.equal(verifyAppProxyQuery(query, config), false);
  }
  assert.equal(verifyAppProxyQuery(signed(), { ...config, appSecret: '' }), false);
  assert.equal(verifyAppProxyQuery(signed(), { ...config, nowSeconds: NaN }), false);
});
