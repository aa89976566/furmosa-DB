import { prisma } from '../lib/prisma';
import { processDueAutomationJobs } from '../lib/automation/line-jobs';
import { retryFailedShopifyIntakes } from '../lib/shopify/recovery';
import { meetpetsAdapter } from '../lib/adoption/meetpets-source.mjs';
import { runAdoptionSync } from '../lib/adoption/sync-worker.mjs';

async function main() {
  const [automation, shopify] = await Promise.all([
    processDueAutomationJobs(50),
    retryFailedShopifyIntakes(prisma, 10),
  ]);
  console.log(JSON.stringify({ ok: true, automation, shopify }));
  // Keep adoption source slowness/failures independent of existing order/LINE jobs.
  try {
    const adoption = await Promise.all([undefined, meetpetsAdapter].map(adapter => runAdoptionSync(prisma, {
      enabled: process.env.ADOPTION_SYNC_ENABLED === 'true',
      origin: 'scheduled', adapter,
    })));
    console.log(JSON.stringify({ adoption }));
  } catch (error) {
    console.error('[adoption-sync]', error instanceof Error ? error.message : 'Worker failed');
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[automation-worker]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
