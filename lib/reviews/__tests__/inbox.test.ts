import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reviewInboxTotal, reviewKindLabel } from '@/lib/reviews/inbox';

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
});
