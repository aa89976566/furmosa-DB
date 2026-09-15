import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isGlobalSearchListPath,
  resolveGlobalSearchHref,
  resolveGlobalSearchListPath,
} from '../global-search-nav';

describe('global-search-nav', () => {
  it('maps every feature page to global results', () => {
    assert.equal(resolveGlobalSearchListPath('/orders/new'), '/search');
    assert.equal(resolveGlobalSearchListPath('/vendors'), '/search');
    assert.equal(resolveGlobalSearchListPath('/dashboard'), '/search');
    assert.equal(isGlobalSearchListPath('/orders'), false);
    assert.equal(isGlobalSearchListPath('/search'), true);
  });

  it('does not carry feature-list filters into global search', () => {
    assert.equal(
      resolveGlobalSearchHref('/orders', 'source=line&work=now&page=3', '曼'),
      '/search?q=%E6%9B%BC',
    );
  });

  it('updates and clears the query on the results page', () => {
    assert.equal(
      resolveGlobalSearchHref('/search', 'q=%E6%9B%BC&page=3', '星汪'),
      '/search?q=%E6%98%9F%E6%B1%AA',
    );
    assert.equal(resolveGlobalSearchHref('/search', 'q=%E6%9B%BC', ''), '/search');
    assert.equal(resolveGlobalSearchHref('/search', 'q=%E6%9B%BC', '曼'), null);
  });

  it('ignores empty search outside the results page', () => {
    assert.equal(resolveGlobalSearchHref('/dashboard', '', '  '), null);
  });
});
