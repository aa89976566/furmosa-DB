import type { PrismaClient } from '@prisma/client';
import { getShopifyAdminAccessToken, shopifyAdminAuthConfigFromEnv } from './admin-access-token.ts';
import { HQ_MAIN_SHOPIFY_LOCATION } from './inventory-location.ts';
import { InventoryWriteError, writeVerifiedInventory } from './inventory-write.ts';
import { loadSalmonStockSource, SALMON_STOCK, StockSourceError } from './salmon-stock-source.ts';
import { readSalmonOrderDemand, verifyDemandCoverage, StockDemandError } from './salmon-order-demand.ts';

export type InventorySyncMode = 'inspect' | 'apply';
type Dependencies = {
  source: typeof loadSalmonStockSource; orders: typeof readSalmonOrderDemand;
  write: typeof writeVerifiedInventory; token: typeof getShopifyAdminAccessToken;
};
const defaults: Dependencies = { source: loadSalmonStockSource, orders: readSalmonOrderDemand,
  write: writeVerifiedInventory, token: getShopifyAdminAccessToken };

/** One verified, exclusive 50g tier. Never writes HQ balances or bypasses shipment READY. */
export async function runSalmonInventorySync(db: PrismaClient, mode: InventorySyncMode,
  deps: Dependencies = defaults, env: NodeJS.ProcessEnv = process.env) {
  const auth = shopifyAdminAuthConfigFromEnv(env);
  const domain = auth.domain.trim().toLowerCase();
  const audit = await db.statusAuditLog.create({ data: { entityType: 'shopify_inventory_sync', entityId: SALMON_STOCK.productId,
    newStatus: 'STARTED', actorType: 'system', actorId: 'salmon-stock-worker', metadataJson: { mode, sku: SALMON_STOCK.sku } } });
  let writeAttempted = false;
  try {
    if (mode === 'apply' && await db.statusAuditLog.findFirst({ where: {
      entityType: 'shopify_inventory_sync', entityId: SALMON_STOCK.productId, newStatus: 'NEEDS_VERIFICATION',
    }, select: { id: true } })) throw new StockDemandError('PREVIOUS_WRITE_REQUIRES_RECONCILIATION');
    const token = await deps.token(auth);
    const source = await deps.source(db);
    const remote = await deps.orders(domain, token);
    const expectedCommitted = verifyDemandCoverage(source.externalDemand, remote, domain);
    const plan = { ...SALMON_STOCK, ...HQ_MAIN_SHOPIFY_LOCATION, available: source.available, expectedCommitted,
      snapshotComplete: true, issues: [], sourceRevision: source.sourceRevision, observedAt: source.observedAt };
    const verifySourceRevision = async (revision: string) => {
      const latest = await deps.source(db);
      if (latest.sourceRevision !== revision) return false;
      const latestRemote = await deps.orders(domain, token);
      return verifyDemandCoverage(latest.externalDemand, latestRemote, domain) === expectedCommitted;
    };
    let write = null;
    if (mode === 'apply') {
      writeAttempted = true;
      write = await deps.write(plan, { domain, token, verifySourceRevision });
      // A new cross-channel reservation after the final check needs reconciliation, never an automatic restore.
      if (!(await verifySourceRevision(source.sourceRevision))) throw new InventoryWriteError('POST_WRITE_SOURCE_CHANGED');
    }
    const summary = { mode, sku: SALMON_STOCK.sku, onHandGrams: source.onHandGrams,
      outstandingGrams: source.outstandingGrams, available: source.available, expectedCommitted,
      sourceRevision: source.sourceRevision, locationId: plan.locationId, write };
    await db.statusAuditLog.update({ where: { id: audit.id }, data: {
      newStatus: mode === 'apply' ? 'VERIFIED' : 'INSPECTED', metadataJson: summary } });
    return summary;
  } catch (error) {
    const reason = error instanceof StockSourceError || error instanceof StockDemandError || error instanceof InventoryWriteError
      ? error.message : 'SYNC_FAILED';
    await db.statusAuditLog.update({ where: { id: audit.id }, data: { newStatus: writeAttempted ? 'NEEDS_VERIFICATION' : 'BLOCKED',
      metadataJson: { mode, sku: SALMON_STOCK.sku, reason } } });
    throw new Error(reason);
  }
}
