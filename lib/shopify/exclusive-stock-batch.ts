import type { PrismaClient } from '@prisma/client';
import { runExclusiveInventorySync, type InventorySyncMode } from './salmon-inventory-sync.ts';
import type { StockTarget } from './salmon-stock-source.ts';

// Verified HQ tiers and Shopify identities, 2026-11-17. Never auto-enrol a product by name or category.
export const EXCLUSIVE_STOCK_TARGETS: readonly StockTarget[] = [
  ['cmvibnp05004sedf0sa0q1gzr', 'cmviboxlr004uedf0jnczgiab', 'QIQI-D01-BEF-001', '64952565203321', '67000321278329'],
  ['cmvic4lxx0053edf03wli8v3u', 'cmvic5ltx0055edf04wnn0sua', 'QIQI-D01-BEF-002', '64952567464313', '67000323506553'],
  ['cmvic71yy0057edf0ufedv3ds', 'cmvnmg7ri0001azzxv247rjh9', 'QIQI-D01-BEF-003', '64952569627001', '67000325734777'],
  ['cmvfgjq7j000w117kvnn7qco4', 'cmvfh4gfc0007db6nmis0dxmq', 'QIQI-D01-CHK-001', '64827154792825', '66871475044729'],
  ['cmvfgnc5k000y117k88fnknkx', 'cmvfhb4w60009db6n1w9ywuhf', 'QIQI-D01-CHK-002', '64827154825593', '66871475110265'],
  ['cmvfgohxd0010117kauhbij7c', 'cmvfhdnkr000bdb6nazrele0o', 'QIQI-D01-CHK-003', '64827154858361', '66871475143033'],
  ['cmvfgsktx0012117kidsqkxkt', 'cmvi1zhcc003bedf0srt36sh8', 'QIQI-D01-CHK-004', '64827154891129', '66871475175801'],
  ['cmvfgtkj00014117kwird35y6', 'cmvi22bmj003dedf0u8y5y3id', 'QIQI-D01-FSH-001', '64827154989433', '66871475274105'],
  ['cmvfgz8f90001db6natpqsjak', 'cmvpvys7e002pz0a9jtipqmsr', 'QIQI-D01-FSH-002', '64827155022201', '66871475306873'],
  ['cmvh2zks1000hedf0h5t0teqt', 'cmvh38ag0000jedf0b8cmvyfp', 'QIQI-D01-SHR-001', '64827155087737', '66871475372409'],
].map(([productId, tierId, sku, variant, item]) => ({ productId, tierId, sku,
  variantId: `gid://shopify/ProductVariant/${variant}`, inventoryItemId: `gid://shopify/InventoryItem/${item}`, gramsPerItem: 40 }));

/** Serial bounded batch: each SKU has its own audit, reservation snapshot and write gate. */
export async function runExclusiveStockBatch(db: PrismaClient, mode: InventorySyncMode,
  env: NodeJS.ProcessEnv = process.env, run = runExclusiveInventorySync, signal?: AbortSignal) {
  const results: { sku: string; status: 'verified' | 'inspected' | 'blocked' }[] = [];
  for (const target of EXCLUSIVE_STOCK_TARGETS) {
    if (signal?.aborted) break;
    try {
      await run(db, mode, target, env);
      results.push({ sku: target.sku, status: mode === 'apply' ? 'verified' : 'inspected' });
    } catch {
      // Per-product audit contains a sanitized reason. Never print remote errors, tokens or order snapshots.
      results.push({ sku: target.sku, status: 'blocked' });
    }
  }
  return { mode, results, blocked: results.filter(row => row.status === 'blocked').length };
}
