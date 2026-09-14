import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isJarExchangeProductCategory,
  isConsignmentProductCategory,
  isRestockableProductCategory,
  productProgramLabel,
} from '@/lib/product-category';

test('JAR_EXCHANGE is the only refill-program product category', () => {
  assert.equal(isJarExchangeProductCategory('JAR_EXCHANGE'), true);
  assert.equal(isJarExchangeProductCategory('STANDARD'), false);
  assert.equal(isJarExchangeProductCategory(null), false);
});

test('general consignment excludes refill products', () => {
  assert.equal(isConsignmentProductCategory('STANDARD'), true);
  assert.equal(isConsignmentProductCategory('JAR_EXCHANGE'), false);
  assert.equal(isConsignmentProductCategory('SERVICE'), false);
  assert.equal(isConsignmentProductCategory(null), false);
});

test('HQ program label is derived only from product category', () => {
  assert.equal(productProgramLabel('JAR_EXCHANGE'), '換罐計劃');
  assert.equal(productProgramLabel('STANDARD'), null);
  assert.equal(productProgramLabel(undefined), null);
});

test('restockable rule reuses the canonical refill predicate', () => {
  assert.equal(isRestockableProductCategory('JAR_EXCHANGE'), true);
  assert.equal(isRestockableProductCategory('STANDARD'), true);
  assert.equal(isRestockableProductCategory('SERVICE'), false);
});
