import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildLegacyShopHomeMessages,
  buildShopHomeMessages,
  buildShopProductDetailMessages,
  buildShopProductMessages,
} from '../shop-flex';

describe('LINE hybrid shopping Flex', () => {
  it('starts with a text question and postback quick replies', () => {
    const raw = JSON.stringify(buildShopHomeMessages());
    assert.match(raw, /想幫毛孩找哪一種/);
    assert.match(raw, /quickReply/);
    assert.match(raw, /jd=shop_category&amp;category=treats|jd=shop_category&category=treats/);
    assert.doesNotMatch(raw, /bark-sniff-shopping-hero-v1\.jpg/);
    assert.doesNotMatch(raw, /"type":"message"/);
  });

  it('keeps the legacy hero builder available for rollback', () => {
    const raw = JSON.stringify(buildLegacyShopHomeMessages());
    assert.match(raw, /bark-sniff-shopping-hero-v1\.jpg/);
    assert.match(raw, /"aspectRatio":"20:13"/);
  });

  it('renders real product photos with a neutral in-chat cart action', () => {
    const messages = buildShopProductMessages('treats', [{
      id: '1', title: '牛肉凍乾', handle: 'beef-freeze-dried', productType: '寵物零食',
      tags: ['凍乾'], imageUrl: 'https://cdn.example.com/beef.jpg', variantId: '11',
      variantTitle: '100g', price: 359, available: true,
    }]);
    const raw = JSON.stringify(messages);
    assert.match(raw, /carousel/);
    assert.match(raw, /beef\.jpg/);
    assert.match(raw, /NT\$359/);
    assert.match(raw, /看商品介紹/);
    assert.match(raw, /加入購物車/);
    assert.match(raw, /jd=shop_product/);
    assert.match(raw, /jd=shop_cart/);
    assert.match(raw, /jd=shop_add&amp;variant=11|jd=shop_add&variant=11/);
    assert.doesNotMatch(raw, /cart\/11:1/);
    assert.doesNotMatch(raw, /products\/beef-freeze-dried/);
    assert.doesNotMatch(raw, /"style":"primary"/);
    assert.doesNotMatch(raw, /"style":"secondary"/);
    assert.doesNotMatch(raw, /100g/);
    assert.match(raw, /jd=shop_category&amp;category=treats|jd=shop_category&category=treats/);
    assert.doesNotMatch(raw, /"type":"message"/);
  });

  it('shows five products and a LINE-native more card', () => {
    const products = Array.from({ length: 6 }, (_, index) => ({
      id: String(index), title: `商品 ${index}`, handle: `product-${index}`,
      productType: '寵物零食', tags: ['零食'], imageUrl: null,
      variantId: String(100 + index), variantTitle: '單一規格', price: 100,
      available: true,
    }));
    const raw = JSON.stringify(buildShopProductMessages('treats', products));
    assert.equal((raw.match(/"type":"bubble"/g) ?? []).length, 6);
    assert.match(raw, /jd=shop_more&amp;category=treats&amp;page=2|jd=shop_more&category=treats&page=2/);
    assert.doesNotMatch(raw, /商品 5/);

    const lastPage = JSON.stringify(buildShopProductMessages('treats', products, { page: 99 }));
    assert.match(lastPage, /商品 5/);
    assert.doesNotMatch(lastPage, /"contents":\[\]/);
  });

  it('opens product information before adding and keeps cart reachable', () => {
    const raw = JSON.stringify(buildShopProductDetailMessages({
      id: '1', title: '雞霸', handle: 'jiba', productType: '寵物零食',
      tags: ['零食'], imageUrl: 'https://cdn.example.com/jiba.jpg',
      variantId: '11', variantTitle: '45g', price: 299, available: true,
      description: '台灣雞胸肉製作，適合日常犒賞。',
    }));
    assert.match(raw, /台灣雞胸肉製作/);
    assert.match(raw, /45g/);
    assert.match(raw, /jd=shop_add/);
    assert.match(raw, /jd=shop_cart/);
  });
});
