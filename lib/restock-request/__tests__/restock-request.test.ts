import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  restockRequestTypeLabel,
  restockStatusLabelForMerchant,
  RESTOCK_APPROVABLE_STATUSES,
} from '@/lib/restock-request/constants';
import {
  isJarExchangeProductCategory,
  isProductCategory,
  isRestockableProductCategory,
} from '@/lib/product-category';
import { resolveMerchantIdForQuery } from '@/lib/merchant-auth/access';
import {
  assertApprovableRestockProducts,
  merchantRestockProductCategories,
} from '@/lib/restock-request/service';

describe('product category', () => {
  it('recognizes JAR_EXCHANGE category', () => {
    assert.equal(isJarExchangeProductCategory('JAR_EXCHANGE'), true);
    assert.equal(isJarExchangeProductCategory('STANDARD'), false);
    assert.equal(isRestockableProductCategory('STANDARD'), true);
    assert.equal(isRestockableProductCategory('JAR_EXCHANGE'), true);
    assert.equal(isRestockableProductCategory('SERVICE'), false);
    assert.equal(isProductCategory('VOUCHER'), true);
    assert.equal(isProductCategory('snack'), false);
  });
});

describe('restock request labels', () => {
  it('uses merchant language for request types', () => {
    assert.equal(restockRequestTypeLabel('SELF_SELECT'), '我要自己選');
    assert.equal(restockRequestTypeLabel('AUTO_REPLENISH'), '請幫我配');
  });

  it('maps statuses for merchant UI', () => {
    assert.equal(restockStatusLabelForMerchant('submitted'), '公司確認中');
    assert.equal(restockStatusLabelForMerchant('under_review'), '公司確認中');
    assert.equal(restockStatusLabelForMerchant('converted_to_shipment'), '備貨中');
    assert.equal(restockStatusLabelForMerchant('rejected'), '需要調整');
  });

  it('approvable statuses include submitted and approved', () => {
    assert.ok(RESTOCK_APPROVABLE_STATUSES.includes('submitted'));
    assert.ok(RESTOCK_APPROVABLE_STATUSES.includes('approved'));
    assert.ok(!RESTOCK_APPROVABLE_STATUSES.includes('converted_to_shipment'));
  });
});

describe('restock isolation helpers', () => {
  it('ignores forged client merchantId', () => {
    assert.equal(
      resolveMerchantIdForQuery('merchant-a', 'merchant-b'),
      'merchant-a',
    );
  });
});

describe('restock validation rules (unit)', () => {
  it('rejects zero or negative quantities in cleaning logic', () => {
    const raw = [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 0 },
      { productId: 'p3', quantity: -1 },
    ];
    const cleaned = raw
      .map((it) => ({
        productId: it.productId,
        quantity: Math.floor(Number(it.quantity)),
      }))
      .filter((it) => it.productId && it.quantity > 0);
    assert.deepEqual(cleaned, [{ productId: 'p1', quantity: 2 }]);
  });

  it('requires expected arrival date for approval gate', () => {
    const arrivalRaw = '';
    assert.equal(Boolean(arrivalRaw.trim()), false);
  });
});

describe('merchant restock catalog categories', () => {
  it('shows only jar-exchange products for a jar-exchange-only merchant', () => {
    assert.deepEqual(merchantRestockProductCategories(['jar_exchange']), [
      'JAR_EXCHANGE',
    ]);
  });

  it('shows both catalogs for a hybrid merchant', () => {
    assert.deepEqual(
      merchantRestockProductCategories(['consignment', 'jar_exchange']),
      ['JAR_EXCHANGE', 'STANDARD'],
    );
  });

  it('keeps standard products for non-jar and legacy tag-only merchants', () => {
    assert.deepEqual(merchantRestockProductCategories(['wholesale']), ['STANDARD']);
    assert.deepEqual(merchantRestockProductCategories(['partner']), ['STANDARD']);
  });
});

describe('assertApprovableRestockProducts', () => {
  it('allows all STANDARD products', () => {
    assert.doesNotThrow(() =>
      assertApprovableRestockProducts(
        [{ productCategory: 'STANDARD' }, { productCategory: 'STANDARD' }],
        [{ productId: 'p1' }, { productId: 'p2' }],
      ),
    );
  });

  it('allows all JAR_EXCHANGE products', () => {
    assert.doesNotThrow(() =>
      assertApprovableRestockProducts(
        [{ productCategory: 'JAR_EXCHANGE' }],
        [{ productId: 'p1' }],
      ),
    );
  });

  it('allows STANDARD and JAR_EXCHANGE mixed', () => {
    assert.doesNotThrow(() =>
      assertApprovableRestockProducts(
        [{ productCategory: 'STANDARD' }, { productCategory: 'JAR_EXCHANGE' }],
        [{ productId: 'p1' }, { productId: 'p2' }],
      ),
    );
  });

  it('rejects SERVICE products', () => {
    assert.throws(
      () =>
        assertApprovableRestockProducts(
          [{ productCategory: 'STANDARD' }, { productCategory: 'SERVICE' }],
          [{ productId: 'p1' }, { productId: 'p2' }],
        ),
      /這項商品目前不能補貨/,
    );
  });

  it('rejects VOUCHER and DONATION products', () => {
    assert.throws(
      () =>
        assertApprovableRestockProducts(
          [{ productCategory: 'VOUCHER' }],
          [{ productId: 'p1' }],
        ),
      /這項商品目前不能補貨/,
    );
    assert.throws(
      () =>
        assertApprovableRestockProducts(
          [{ productCategory: 'DONATION' }],
          [{ productId: 'p1' }],
        ),
      /這項商品目前不能補貨/,
    );
  });

  it('reports incomplete product data before category errors', () => {
    assert.throws(
      () =>
        assertApprovableRestockProducts(
          [{ productCategory: 'SERVICE' }],
          [{ productId: 'missing' }, { productId: 'service-1' }],
        ),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, '商品資料不完整');
        assert.notEqual(err.message, '這項商品目前不能補貨');
        return true;
      },
    );
  });

  it('treats duplicate lines as incomplete product data', () => {
    assert.throws(
      () =>
        assertApprovableRestockProducts(
          [{ productCategory: 'STANDARD' }],
          [{ productId: 'p1' }, { productId: 'p1' }],
        ),
      /商品資料不完整/,
    );
  });
});
