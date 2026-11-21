import { prisma } from '../lib/prisma';
import { processDueAutomationJobs } from '../lib/automation/line-jobs';
import { retryFailedShopifyIntakes } from '../lib/shopify/recovery';
import { meetpetsAdapter } from '../lib/adoption/meetpets-source.mjs';
import { runAdoptionSync } from '../lib/adoption/sync-worker.mjs';
import { runSalmonInventorySync } from '../lib/shopify/salmon-inventory-sync';
import { runExclusiveStockBatch } from '../lib/shopify/exclusive-stock-batch';

const shutdown = new AbortController();
const requestShutdown = () => {
  if (shutdown.signal.aborted) return;
  shutdown.abort();
  console.log('[automation-worker] Shutdown requested; finishing active work');
};

process.on('SIGTERM', requestShutdown);
process.on('SIGINT', requestShutdown);

async function main() {
  const [automation, shopify] = await Promise.all([
    processDueAutomationJobs(50),
    retryFailedShopifyIntakes(prisma, 10),
  ]);
  console.log(JSON.stringify({ ok: true, automation, shopify }));
  if (shutdown.signal.aborted) return;
  if (process.env.SHOPIFY_INVENTORY_SYNC_ENABLED === 'true') {
    try {
      const mode = process.env.SHOPIFY_INVENTORY_SYNC_MODE === 'apply' ? 'apply' : 'inspect';
      console.log(JSON.stringify({ inventory: await runSalmonInventorySync(prisma, mode) }));
    } catch {
      console.error('[shopify-inventory] Blocked; inspect shopify_inventory_sync audit');
      process.exitCode = 1;
    }
  }
  if (shutdown.signal.aborted) return;
  if (process.env.SHOPIFY_INVENTORY_SYNC_EXTENDED_ENABLED === 'true') {
    const mode = process.env.SHOPIFY_INVENTORY_SYNC_EXTENDED_MODE === 'apply' ? 'apply' : 'inspect';
    const inventoryBatch = await runExclusiveStockBatch(prisma, mode, process.env, undefined, shutdown.signal);
    console.log(JSON.stringify({ inventoryBatch }));
    if (inventoryBatch.blocked) process.exitCode = 1;
  }
  if (shutdown.signal.aborted) return;
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
    try {
      await prisma.$disconnect();
    } finally {
      process.off('SIGTERM', requestShutdown);
      process.off('SIGINT', requestShutdown);
    }
  });
