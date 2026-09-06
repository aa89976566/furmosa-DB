import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  orderContentSummary,
  orderReferenceSummary,
  reviewInboxTotal,
  reviewKindLabel,
} from '@/lib/reviews/inbox';

describe('review inbox labels', () => {
  it('names the three review kinds for HQ staff', () => {
    assert.equal(reviewKindLabel('shopify_order'), 'Shopify 訂單');
    assert.equal(reviewKindLabel('ugc'), 'UGC 審核');
    assert.equal(reviewKindLabel('restock'), '補貨申請');
  });

  it('adds pending counts together so the sidebar badge can show one number', () => {
    assert.equal(reviewInboxTotal({ shopify_order: 2, ugc: 1, restock: 3 }), 6);
    assert.equal(reviewInboxTotal({ shopify_order: 0, ugc: 0, restock: 0 }), 0);
  });

  it('uses saved order items as the primary content summary', () => {
    assert.equal(
      orderContentSummary({
        items: [{ productName: '雞肉凍乾' }, { productName: '水晶魚凍乾' }],
      }),
      '雞肉凍乾 等 2 項',
    );
  });

  it('falls back to Shopify snapshot items instead of repeating the order number', () => {
    assert.equal(
      orderContentSummary({
        items: [],
        shopifySnapshot: {
          schemaVersion: 1,
          order: { line_items: [{ title: '原味雞霸', quantity: 5, price: '89.00' }] },
        },
      }),
      '原味雞霸',
    );
    assert.equal(orderContentSummary({ items: [] }), '商品明細尚未同步');
  });

  it('shows each order reference only once', () => {
    assert.equal(orderReferenceSummary(['#1022', '#1022', null]), '#1022');
    assert.equal(orderReferenceSummary(['#1022', '王小明']), '#1022 · 王小明');
  });
});
