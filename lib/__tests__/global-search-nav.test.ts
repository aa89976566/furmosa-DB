import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isGlobalSearchListPath,
  resolveGlobalSearchHref,
  resolveGlobalSearchListPath,
} from '../global-search-nav';

describe('global-search-nav', () => {
  it('maps nested order pages to orders list', () => {
    assert.equal(resolveGlobalSearchListPath('/orders/new'), '/orders');
    assert.equal(resolveGlobalSearchListPath('/orders/abc/edit'), '/orders');
    assert.equal(isGlobalSearchListPath('/orders/new'), false);
    assert.equal(isGlobalSearchListPath('/orders'), true);
  });

  it('from /orders/new navigates to list with q (the mobile bug)', () => {
    assert.equal(
      resolveGlobalSearchHref('/orders/new', '', '曼'),
      '/orders?q=%E6%9B%BC',
    );
  });

  it('on list page updates q and clears page', () => {
    assert.equal(
      resolveGlobalSearchHref('/orders', 'source=line&page=3', '曼'),
      '/orders?source=line&q=%E6%9B%BC',
    );
  });

  it('clearing q on list removes it', () => {
    assert.equal(resolveGlobalSearchHref('/orders', 'q=%E6%9B%BC', ''), '/orders');
  });

  it('noop when already on same href', () => {
    assert.equal(resolveGlobalSearchHref('/orders', 'q=%E6%9B%BC', '曼'), null);
  });

  it('vendors section searches products', () => {
    assert.equal(resolveGlobalSearchListPath('/vendors'), '/products');
    assert.equal(
      resolveGlobalSearchHref('/vendors/new', '', '飼料'),
      '/products?q=%E9%A3%BC%E6%96%99',
    );
  });

  it('jar-exchange ops falls back to members list', () => {
    assert.equal(resolveGlobalSearchListPath('/jar-exchange/ops'), '/jar-exchange/members');
    assert.equal(
      resolveGlobalSearchHref('/jar-exchange/ops', '', '0912'),
      '/jar-exchange/members?q=0912',
    );
  });

  it('dashboard defaults to orders', () => {
    assert.equal(resolveGlobalSearchListPath('/dashboard'), '/orders');
    assert.equal(
      resolveGlobalSearchHref('/dashboard', '', '陳'),
      '/orders?q=%E9%99%B3',
    );
  });
});
