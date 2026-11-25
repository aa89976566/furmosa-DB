import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildShopHomeMessages, buildShopProductMessages } from '../shop-flex';

describe('LINE hybrid shopping Flex', () => {
  it('shows the branded category chooser inside the conversation', () => {
    const raw = JSON.stringify(buildShopHomeMessages());
    assert.match(raw, /今天想寵哪一招/);
    assert.match(raw, /hoodie-dog-shopping-packages-v4\.png/);
    assert.match(raw, /"aspectMode":"fit"/);
    assert.doesNotMatch(raw, /"aspectMode":"contain"/);
    assert.match(raw, /好料先吃/);
    assert.match(raw, /玩到沒電/);
    assert.match(raw, /送禮有面子/);
    assert.match(raw, /全部都要/);
    assert.match(raw, /逛零食/);
    assert.match(raw, /逛玩具/);
    assert.match(raw, /逛禮品/);
    assert.match(raw, /逛全部/);
    assert.doesNotMatch(raw, /quickReply/);
    assert.doesNotMatch(raw, /狗老闆/);
    assert.doesNotMatch(raw, /"style":"primary"/);
    assert.doesNotMatch(raw, /"style":"secondary"/);
  });

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
