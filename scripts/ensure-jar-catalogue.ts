/**
 * 建置／維運：把 refill_flavours 對齊成 JAR_EXCHANGE Product，
 * 讓 POS「自己選」與 HQ 叫貨目錄有東西可選。
 *
 *   npx tsx scripts/ensure-jar-catalogue.ts
 */
import { ensureRefillPlanSeeded } from '../lib/jar-exchange/refill-flavours';
import { syncJarExchangeCatalogue } from '../lib/jar-exchange/catalogue-sync';
import { prisma } from '../lib/prisma';

async function main() {
  await ensureRefillPlanSeeded();
  const result = await syncJarExchangeCatalogue();
  const jarCount = await prisma.product.count({
    where: { productCategory: 'JAR_EXCHANGE', status: 'active' },
  });
  console.log(
    `[jar-catalogue] linked=${result.linked} created=${result.created} activeJarProducts=${jarCount}`,
  );
}

main()
  .catch((err) => {
    console.error('[jar-catalogue] failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
