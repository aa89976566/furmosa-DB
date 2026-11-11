import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLAN = 'hq_collab_wax_opening_20261111';
export const MIGRATION = 'prisma/migrations/20261111200004_variant_inventory/migration.sql';
export const OPENING = 'scripts/ops/initialize-collab-wax-variants.sql';
export const OPENING_SHA256 = '8c9c3396ec0621e9cad178ef633ecb6e1125506ab762be5b8cda860501889562';
export const BALANCE_QUERY = `
      SELECT t.shopify_variant_id AS "variantId", t.inventory_policy AS policy, b.unit, b.quantity,
        COALESCE(sum(x.quantity),0)::int AS "ledgerQuantity",
        count(*) FILTER (WHERE x.type='opening' AND x.reference='opening:collab-wax-20261111')::int AS openings,
        sum(x.quantity) FILTER (WHERE x.type='opening' AND x.reference='opening:collab-wax-20261111')::int AS "openingQuantity",
        max((x."sourceSnapshot"->>'candleCost')::int) FILTER (WHERE x.type='opening') AS "snapshotCandleCost",
        max((x."sourceSnapshot"->>'bundleUnitCost')::int) FILTER (WHERE x.type='opening') AS "snapshotBundleCost"
      FROM "ProductPriceTier" t
      JOIN "ProductVariantInventoryBalance" b ON b."tierId"=t.id
      JOIN "Warehouse" w ON w.id=b."warehouseId" AND w.code='WH-MAIN'
      LEFT JOIN "ProductVariantInventoryTransaction" x ON x."tierId"=t.id AND x."warehouseId"=w.id
      WHERE t."productId"=$1
      GROUP BY t.id,b."tierId",b."warehouseId"
      ORDER BY t.shopify_variant_id
    `;
const PRODUCT = '809871bc-c7b9-448a-8c27-73cb8e801fd0';
const VARIANTS = ['65200876290425','65200876323193','65200876355961','65200876388729'];

export function verifyScope(raw, sql, env) {
  const paths = JSON.parse(raw ?? 'null');
  if (!Array.isArray(paths) || paths.length !== 1 || paths[0] !== MIGRATION) throw new Error('Opening plan requires the exact variant migration only');
  if (createHash('sha256').update(sql).digest('hex') !== OPENING_SHA256) throw new Error('Opening SQL checksum differs; stop for review');
  if (env.RELEASE_MIGRATION_PLAN !== PLAN || env.GITHUB_ACTIONS !== 'true'
      || !/^[0-9a-f]{40}$/i.test(env.RELEASE_EXPECTED_HEAD_SHA ?? '')
      || !/^[1-9][0-9]*$/.test(env.RELEASE_PR_NUMBER ?? '')) throw new Error('Controlled exact-PR release context required');
  const db = new URL(env.DIRECT_URL ?? env.DATABASE_URL ?? '');
  const direct = db.hostname === 'db.ukjjopridghvwzobrsus.supabase.co';
  const pooler = db.hostname === 'aws-1-ap-northeast-1.pooler.supabase.com'
    && decodeURIComponent(db.username) === 'postgres.ukjjopridghvwzobrsus';
  if (!['postgresql:','postgres:'].includes(db.protocol) || (!direct && !pooler)) throw new Error('Unexpected production database target');
}

export function verifyBalances(rows) {
  if (rows.length !== 4 || new Set(rows.map(r => r.variantId)).size !== 4) throw new Error('Expected exactly four unique scent balances');
  for (const row of rows) {
    if (!VARIANTS.includes(row.variantId) || row.unit !== '顆' || row.policy !== 'variant'
      || Number(row.openings) !== 1 || Number(row.openingQuantity) !== 20
      || Number(row.snapshotCandleCost) !== 190 || Number(row.snapshotBundleCost) !== 230
      || Number(row.quantity) !== Number(row.ledgerQuantity)) throw new Error('Opening ledger verification failed');
  }
  return rows.map(r => ({ variantId: r.variantId, quantity: Number(r.quantity), unit: r.unit }));
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, { env: process.env, stdio: 'pipe' });
  if (result.status !== 0) {
    const detail = String(result.stderr ?? '').replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[REDACTED_DATABASE_URL]').slice(-2000);
    throw new Error('Controlled opening step failed: ' + detail);
  }
}

async function main() {
  verifyScope(process.env.RELEASE_MIGRATION_PATHS, readFileSync(OPENING, 'utf8'), process.env);
  runNode(['scripts/release/deploy-standard-migrations.mjs']);
  runNode(['node_modules/prisma/build/index.js','db','execute','--file',OPENING,'--schema','prisma/schema.prisma']);
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(BALANCE_QUERY, PRODUCT);
    console.log(JSON.stringify({ plan: PLAN, balances: verifyBalances(rows), verified: true }));
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
