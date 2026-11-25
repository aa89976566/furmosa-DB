import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getCartUrl,
  getProductUrl,
  normalizeShopifyProducts,
  productMatchesCategory,
} from '../shop-catalog';

const products = normalizeShopifyProducts({
  products: [
    {
      id: 1,
      title: '牛肉凍乾',
      handle: 'beef-freeze-dried',
      product_type: '寵物零食',
      tags: ['凍乾'],
      images: [{ src: 'https://cdn.example.com/beef.jpg' }],
      variants: [
        { id: 10, title: '50g', price: '199.00', available: false },
        { id: 11, title: '100g', price: '359.00', available: true },
      ],
    },
    {
      id: 2,
      title: '拉扯繩',
      handle: 'rope-toy',
      product_type: '寵物玩具',
      tags: ['互動玩具'],
      variants: [{ id: 20, title: 'Default Title', price: '299', available: true }],
    },
  ],
});

describe('LINE shop catalog', () => {
  it('normalizes products and chooses the first available variant', () => {
    assert.equal(products.length, 2);
    assert.equal(products[0]?.variantId, '11');
    assert.equal(products[0]?.price, 359);
    assert.equal(products[0]?.imageUrl, 'https://cdn.example.com/beef.jpg');
  });

  it('classifies products without changing Shopify data', () => {
    assert.equal(productMatchesCategory(products[0]!, 'treats'), true);
    assert.equal(productMatchesCategory(products[0]!, 'toys'), false);
    assert.equal(productMatchesCategory(products[1]!, 'toys'), true);
  });

  it('does not misclassify a food-hiding toy as food', () => {
    const toy = { ...products[1]!, title: '藏食益智玩具', tags: ['藏食'] };
    assert.equal(productMatchesCategory(toy, 'treats'), false);
    assert.equal(productMatchesCategory(toy, 'toys'), true);
  });

  it('shows gifts but excludes booking services from shopping', () => {
    const gift = {
      ...products[1]!,
      title: '雞霸吊飾',
      productType: '手作黏土吊飾',
      tags: ['禮品', '鑰匙圈'],
    };
    const booking = {
      ...products[1]!,
      title: '動物溝通預約',
      productType: '預約服務',
      tags: ['動物溝通'],
    };
    assert.equal(productMatchesCategory(gift, 'gifts'), true);
    assert.equal(productMatchesCategory(gift, 'all'), true);
    assert.equal(productMatchesCategory(booking, 'gifts'), false);
    assert.equal(productMatchesCategory(booking, 'all'), false);
  });

  it('builds Shopify product and cart URLs', () => {
    assert.equal(getProductUrl(products[0]!), 'https://furmosa.com/products/beef-freeze-dried');
    assert.equal(getCartUrl(products[0]!), 'https://furmosa.com/cart/11:1');
  });
});
