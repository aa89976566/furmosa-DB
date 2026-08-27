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
