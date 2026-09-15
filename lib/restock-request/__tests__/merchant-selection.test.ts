import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '@/lib/prisma';
import { assertMerchantRestockSelection } from '../service';

test('POS submissions accept only active products in the authenticated merchant catalog', async () => {
  const original = {
    merchant: prisma.merchant.findUnique, raw: prisma.$queryRaw,
    product: prisma.product.findMany, stock: prisma.merchantStock.findMany,
    rule: prisma.merchantProductRule.findMany,
  };
  prisma.merchant.findUnique = (async () => ({ type: 'consignment' })) as any;
  prisma.$queryRaw = (async () => [{ types: ['consignment'], type: 'consignment' }]) as any;
  prisma.product.findMany = (async ({ where }: any) => {
    assert.equal(where.status, 'active');
    assert.deepEqual(where.productCategory.in, ['STANDARD']);
    return [{ id: 'own', productCategory: 'STANDARD' }, { id: 'foreign', productCategory: 'STANDARD' }];
  }) as any;
  prisma.merchantStock.findMany = (async ({ where }: any) => {
    assert.equal(where.merchantId, 'store-a');
    return [{ productId: 'own', quantity: 3 }];
  }) as any;
  prisma.merchantProductRule.findMany = (async () => []) as any;
  try {
    await assert.doesNotReject(assertMerchantRestockSelection('store-a', ['own']));
    await assert.rejects(assertMerchantRestockSelection('store-a', ['foreign']), /本店可補貨清單/);
    await assert.rejects(assertMerchantRestockSelection('store-a', ['inactive']), /本店可補貨清單/);
  } finally {
    prisma.merchant.findUnique = original.merchant; prisma.$queryRaw = original.raw;
    prisma.product.findMany = original.product; prisma.merchantStock.findMany = original.stock;
    prisma.merchantProductRule.findMany = original.rule;
  }
});
