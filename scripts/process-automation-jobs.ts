import { prisma } from '../lib/prisma';
import { processDueAutomationJobs } from '../lib/automation/line-jobs';
import { retryFailedShopifyIntakes } from '../lib/shopify/recovery';

async function main() {
  const [automation, shopify] = await Promise.all([
    processDueAutomationJobs(50),
    retryFailedShopifyIntakes(prisma, 10),
  ]);
  console.log(JSON.stringify({ ok: true, automation, shopify }));
}

main()
  .catch((error) => {
    console.error('[automation-worker]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
