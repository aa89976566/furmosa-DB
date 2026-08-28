import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterQueryFeed, groupSaleLines, type QueryFeedItem } from '@/lib/pos/query-feed';

describe('groupSaleLines', () => {
  it('groups same-second sales into one 已完成 ticket', () => {
    const at = new Date('2026-08-26T10:42:01.200Z');
    const items = groupSaleLines([
      { id: '1', createdAt: at, quantity: -2, unitPrice: 129, productName: '水晶魚' },
      { id: '2', createdAt: new Date(at.getTime() + 20), quantity: -1, unitPrice: 99, productName: '雞霸 原味' },
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.kind, 'sale');
    assert.equal(items[0]?.status, '已完成');
    assert.match(items[0]?.title ?? '', /水晶魚 × 2/);
  });
});

describe('filterQueryFeed', () => {
  const items: QueryFeedItem[] = [
    {
      id: 'r1',
      kind: 'refill',
      at: '2026-08-26T09:00:00.000Z',
      title: '換罐',
      subtitle: '#A3812 → #B9981',
      status: '已完成',
      href: '/pos/refill/1',
      searchText: 'a3812 b9981 王小姐',
    },
    {
      id: 's1',
      kind: 'sale',
      at: '2026-08-26T10:00:00.000Z',
      title: '水晶魚 × 2',
      subtitle: 'NT$258',
      status: '已完成',
      href: '/pos/records',
      searchText: '水晶魚 258',
    },
  ];

  it('filters by kind and serial search', () => {
    assert.equal(filterQueryFeed(items, 'sale', '').length, 1);
    assert.equal(filterQueryFeed(items, 'all', 'A3812').length, 1);
    assert.equal(filterQueryFeed(items, 'all', '水晶魚').length, 1);
  });
});
