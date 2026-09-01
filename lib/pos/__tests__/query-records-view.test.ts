import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterQueryFeed, type QueryFeedItem } from '../query-feed';
import {
  QUERY_CLEAR_FILTERS_LABEL,
  QUERY_EMPTY_ALL,
  QUERY_EMPTY_FILTERED,
  QUERY_ERROR_TITLE,
  QUERY_KIND_FILTERS,
  QUERY_SEARCH_HINT,
  QUERY_SEARCH_LABEL,
  presentQueryRecord,
  queryKindFilterIds,
  queryKindLabel,
  queryRecordsListMode,
  querySearchFeedback,
  queryStatusLabel,
  queryWhenLabel,
  visibleRecordText,
} from '../query-records-view';

const sample: QueryFeedItem[] = [
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

describe('query records view mapping', () => {
  it('keeps filter identities used by the existing query', () => {
    assert.deepEqual(queryKindFilterIds(), ['all', 'sale', 'refill', 'restock', 'stock']);
    assert.equal(QUERY_KIND_FILTERS.find((item) => item.id === 'stock')?.label, '庫存異動');
    assert.equal(filterQueryFeed(sample, 'sale', '').length, 1);
    assert.equal(filterQueryFeed(sample, 'all', 'A3812').length, 1);
    assert.match(QUERY_SEARCH_LABEL, /商品/);
    assert.match(QUERY_SEARCH_HINT, /罐號/);
    assert.doesNotMatch(QUERY_SEARCH_LABEL, /訂單/);
    assert.doesNotMatch(QUERY_SEARCH_HINT, /訂單/);
  });

  it('shows known kinds and statuses in Chinese', () => {
    assert.equal(queryKindLabel('sale'), '銷售');
    assert.equal(queryKindLabel('refill'), '換罐');
    assert.equal(queryKindLabel('restock'), '補貨');
    assert.equal(queryKindLabel('stock'), '庫存異動');
    assert.equal(queryStatusLabel('completed'), '已完成');
    assert.equal(queryStatusLabel('awaiting_extra_payment'), '等待補差額');
    assert.equal(queryStatusLabel('payment_pending'), '尚未付款');
    assert.equal(queryStatusLabel('submitted'), '已送出');
    assert.equal(queryStatusLabel('converted_to_shipment'), '備貨中');
    assert.equal(queryStatusLabel('已完成'), '已完成');
    assert.equal(queryStatusLabel('現在 12'), '現在 12');
  });

  it('uses a safe fallback for unknown values', () => {
    assert.equal(queryKindLabel('mystery'), '紀錄');
    assert.equal(queryKindLabel(null), '紀錄');
    assert.equal(queryStatusLabel('foo_bar'), '狀態不明');
    assert.equal(queryStatusLabel('processing'), '處理中');
    assert.equal(queryWhenLabel('not-a-date'), null);
  });

  it('does not present broken null or undefined fields', () => {
    assert.equal(visibleRecordText(null), null);
    assert.equal(visibleRecordText(undefined), null);
    assert.equal(visibleRecordText('undefined'), null);
    assert.equal(visibleRecordText('null'), null);
    assert.equal(queryStatusLabel(null), null);
    const presented = presentQueryRecord({
      id: 'x',
      kind: 'refill',
      at: '',
      title: 'undefined',
      subtitle: '',
      status: 'null',
      href: '',
      searchText: '',
    });
    assert.equal(presented.detail, null);
    assert.equal(presented.extra, null);
    assert.equal(presented.statusLabel, null);
    assert.equal(presented.whenLabel, null);
    assert.equal(presented.href, null);
    assert.doesNotMatch(JSON.stringify(presented), /undefined/);
    assert.doesNotMatch(JSON.stringify(presented), /"null"/);
  });

  it('uses different copy for no records and filtered no matches', () => {
    assert.equal(QUERY_EMPTY_ALL, '目前還沒有紀錄。');
    assert.equal(QUERY_EMPTY_FILTERED, '找不到符合條件的紀錄。');
    assert.notEqual(QUERY_EMPTY_ALL, QUERY_EMPTY_FILTERED);
    assert.equal(
      queryRecordsListMode({ items: [], kind: 'all', query: '' }).emptyMessage,
      QUERY_EMPTY_ALL,
    );
    assert.equal(
      queryRecordsListMode({ items: sample, kind: 'all', query: '沒有這筆' }).emptyMessage,
      QUERY_EMPTY_FILTERED,
    );
    assert.equal(QUERY_CLEAR_FILTERS_LABEL, '清除搜尋與篩選');
    assert.match(querySearchFeedback('  水晶魚  ') ?? '', /水晶魚/);
  });

  it('does not treat loading as an empty list', () => {
    const view = queryRecordsListMode({
      state: 'loading',
      items: [],
      kind: 'all',
      query: '',
    });
    assert.equal(view.mode, 'loading');
    assert.equal(view.emptyMessage, null);
    assert.notEqual(view.mode, 'empty');
  });

  it('does not treat error as zero records', () => {
    const view = queryRecordsListMode({
      state: 'error',
      items: [],
      kind: 'all',
      query: '',
    });
    assert.equal(view.mode, 'error');
    assert.equal(view.emptyMessage, null);
    assert.notEqual(view.mode, 'empty');
    assert.equal(QUERY_ERROR_TITLE, '紀錄暫時讀取失敗');
  });
});
