import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildShopProductMessages } from '../shop-flex';

describe('LINE hybrid shopping Flex', () => {
  it('renders product photos and Shopify cart links', () => {
    const messages = buildShopProductMessages('treats', [{
      id: '1', title: '牛肉凍乾', handle: 'beef-freeze-dried', productType: '寵物零食',
      tags: ['凍乾'], imageUrl: 'https://cdn.example.com/beef.jpg', variantId: '11',
      variantTitle: '100g', price: 359, available: true,
    }]);
    const raw = JSON.stringify(messages);
    assert.match(raw, /carousel/);
    assert.match(raw, /beef\.jpg/);
    assert.match(raw, /NT\$359/);
    assert.match(raw, /cart\/11:1/);
    assert.match(raw, /加入購物車/);
    assert.doesNotMatch(raw, /100g/);
    assert.match(raw, /逛零食/);
    assert.match(raw, /逛玩具/);
    assert.match(raw, /逛全部/);
  });
});
