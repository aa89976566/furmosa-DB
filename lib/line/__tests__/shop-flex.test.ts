import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildShopHomeMessages, buildShopProductMessages } from '../shop-flex';

describe('LINE hybrid shopping Flex', () => {
  it('starts with the lightweight branded category chooser', () => {
    const raw = JSON.stringify(buildShopHomeMessages());
    assert.match(raw, /想找哪一種/);
    assert.match(raw, /bark-sniff-shopping-hero-v1\.jpg/);
    assert.match(raw, /"aspectRatio":"20:13"/);
    assert.match(raw, /"aspectMode":"cover"/);
    assert.match(raw, /逛零食/);
    assert.match(raw, /逛玩具/);
    assert.match(raw, /逛禮品/);
    assert.match(raw, /逛生活用品/);
    assert.doesNotMatch(raw, /quickReply/);
    assert.doesNotMatch(raw, /今天想寵哪一招/);
    assert.doesNotMatch(raw, /好料先吃|玩到沒電|送禮有面子|全部都要/);
    assert.doesNotMatch(raw, /狗老闆/);
    assert.doesNotMatch(raw, /"style":"primary"/);
    assert.doesNotMatch(raw, /"style":"secondary"/);
  });

  it('renders real product photos with one neutral Shopify product link', () => {
    const messages = buildShopProductMessages('treats', [{
      id: '1', title: '牛肉凍乾', handle: 'beef-freeze-dried', productType: '寵物零食',
      tags: ['凍乾'], imageUrl: 'https://cdn.example.com/beef.jpg', variantId: '11',
      variantTitle: '100g', price: 359, available: true,
    }]);
    const raw = JSON.stringify(messages);
    assert.match(raw, /carousel/);
    assert.match(raw, /beef\.jpg/);
    assert.match(raw, /NT\$359/);
    assert.match(raw, /看商品/);
    assert.match(raw, /products\/beef-freeze-dried/);
    assert.doesNotMatch(raw, /cart\/11:1/);
    assert.doesNotMatch(raw, /加入購物車/);
    assert.doesNotMatch(raw, /"style":"primary"/);
    assert.doesNotMatch(raw, /"style":"secondary"/);
    assert.doesNotMatch(raw, /100g/);
    assert.match(raw, /逛零食/);
    assert.match(raw, /逛玩具/);
    assert.match(raw, /逛禮品/);
    assert.match(raw, /逛生活用品/);
  });
});
