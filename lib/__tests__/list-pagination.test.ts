import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hrefWithPage,
  parsePage,
  totalPages,
} from '@/lib/list-pagination';

describe('list-pagination', () => {
  it('parsePage clamps invalid values', () => {
    assert.equal(parsePage(undefined), 1);
    assert.equal(parsePage('0'), 1);
    assert.equal(parsePage('-3'), 1);
    assert.equal(parsePage('2.9'), 2);
    assert.equal(parsePage('abc'), 1);
  });

  it('totalPages never returns zero', () => {
    assert.equal(totalPages(0, 30), 1);
    assert.equal(totalPages(30, 30), 1);
    assert.equal(totalPages(31, 30), 2);
  });

  it('hrefWithPage preserves filters and omits page=1', () => {
    assert.equal(hrefWithPage('/orders', { source: 'line' }, 1), '/orders?source=line');
    assert.equal(
      hrefWithPage('/orders', { source: 'line', q: 'a' }, 3),
      '/orders?source=line&q=a&page=3',
    );
  });
});
