/**
 * 回填：
 * 1) 換罐店 → MerchantRedeemProfile（兼同步 stores）
 * 2) Customer.signupLocationId（依 storeId / signupStore slug）
 * 3) JarCode.productId（依 productSku）
 *
 * 用法：npx tsx scripts/backfill-signup-location.ts
 */
import { prisma } from '@/lib/prisma';
import { resolveMerchantIdByRedeemSlug } from '@/lib/jar-exchange/location';
import { syncAllJarExchangePartnerStores } from '@/lib/stores/sync-merchant-stores';

async function main() {
  const syncedStores = await syncAllJarExchangePartnerStores();
  console.log(`RedeemProfile／stores 同步：${syncedStores} 家換罐店`);

  const customers = await prisma.customer.findMany({
    where: {
      signupLocationId: null,
      OR: [{ storeId: { not: null } }, { signupStore: { not: null } }],
    },
    select: { id: true, storeId: true, signupStore: true, name: true },
  });

  let linked = 0;
  let missed = 0;
  for (const c of customers) {
    const locationId = await resolveMerchantIdByRedeemSlug(c.storeId ?? c.signupStore);
    if (!locationId) {
      missed++;
      continue;
    }
    await prisma.customer.update({
      where: { id: c.id },
      data: { signupLocationId: locationId },
    });
    linked++;
  }
  console.log(`Customer.signupLocationId：成功 ${linked}，無法對應 ${missed}`);

  const skuFill = await prisma.$executeRaw`
    UPDATE jar_codes jc
    SET product_id = p.id
    FROM "Product" p
    WHERE jc.product_sku IS NOT NULL
      AND jc.product_id IS NULL
      AND p.sku = jc.product_sku
  `;
  console.log(`JarCode.productId 依 SKU 回填列數：${skuFill}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
