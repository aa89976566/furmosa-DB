import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { prisma } from '@/lib/prisma';
import { loadMerchantInventory } from '@/lib/pos/load-inventory';

for (const type of ['consignment', 'jar_exchange']) {
  test(`${type}: inventory includes newly orderable food only for eligible stores, at zero stock`, async () => {
    const originals = [prisma.merchant.findUnique, prisma.$queryRaw, prisma.product.findMany] as const;
    const read = mock.fn(async (args: any) => {
      const standard = args.where.OR.find((branch: any) => branch.productCategory === 'STANDARD');
      // Existing stock must remain visible, even if new ordering is disabled.
      assert.ok(standard.OR.some((branch: any) => branch.merchantStocks?.some?.merchantId === 'store'));
      const newFoodEnabled = standard.OR.some((branch: any) => branch.consignmentEnabled === true);
      const product = { id: 'new-food', name: '豬蛋蛋', sku: 'FUR-0012', sourceSku: null,
        category: 'treats', style: null, imageUrl: null, productCategory: 'STANDARD',
        merchantStocks: [], priceTiers: [{id:'50g',weightGrams:50,unit:'g',unitQty:1}] };
      return newFoodEnabled ? [product] : [];
    });
    prisma.merchant.findUnique = (async () => ({type})) as any;
    prisma.$queryRaw = (async () => [{type,types:[type]}]) as any;
    prisma.product.findMany = read as any;
    try {
      const items = await loadMerchantInventory('store');
      assert.equal(items.length, type === 'consignment' ? 1 : 0);
      if (items.length) {
        assert.equal(items[0].quantity, 0);
        assert.equal(items[0].group, 'baked');
        assert.equal(items[0].tiers?.[0].quantity, 0);
        assert.equal(items[0].buyoutQuantity, 0);
      }
      assert.equal(read.mock.callCount(), 1);
    } finally {
      [prisma.merchant.findUnique, prisma.$queryRaw, prisma.product.findMany] = originals as any;
    }
  });
}
