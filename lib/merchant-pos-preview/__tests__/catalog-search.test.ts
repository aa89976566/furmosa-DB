import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRODUCTS } from '../fixtures';
import { catalogRows, filterCatalog, skuAvailability, stockLevelOf } from '../selectors';
import { addSelectedToCart, createSession, selectVariant, setQuery } from '../session';

describe('merchant POS preview catalog search', () => {
  it('has four fictional products with one to three specs and mixed stock', () => {
    assert.equal(PRODUCTS.length, 4);
    for (const product of PRODUCTS) {
      assert.ok(product.variants.length >= 1 && product.variants.length <= 3);
    }
    const levels = PRODUCTS.flatMap((product) => product.variants.map(stockLevelOf));
    assert.ok(levels.includes('normal'));
    assert.ok(levels.includes('low'));
    assert.ok(levels.includes('sold_out'));
  });

  it('searches by name, SKU, spec and shows empty', () => {
    assert.equal(filterCatalog('牛肉').length, 1);
    assert.equal(filterCatalog('FMT-CHKN').length, 1);
    assert.equal(filterCatalog('小型犬').length, 1);
    assert.equal(filterCatalog('沒有這個商品').length, 0);
    assert.equal(filterCatalog('').length, 4);
  });

  it('requires a spec, disables sold-out add, and keeps a restock entry', () => {
    let session = createSession();
    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart.length, 0);

    session = selectVariant(session, 'prod-beef', 'sku-beef-300');
    assert.equal(session.selectedSkuByProductId['prod-beef'], undefined);
    assert.equal(skuAvailability('sku-beef-300', session.cart).canSelect, false);
    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart.length, 0);

    session = selectVariant(session, 'prod-beef', 'sku-beef-150');
    const lowRow = catalogRows(setQuery(session, '150')).find(
      (row) => row.product.productId === 'prod-beef',
    );
    assert.equal(lowRow?.stockLevel, 'low');
  });
});
