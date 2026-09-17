export const RELEASE_PLANS = Object.freeze({
  none: Object.freeze({
    runner: null,
    migrationPrefixes: Object.freeze([]),
    requiredPaths: Object.freeze([]),
  }),
  hq_inventory_advisory_20260917: Object.freeze({
    runner: 'scripts/ops/deploy-hq-bulk.mjs',
    migrationPrefixes: Object.freeze([
      'prisma/migrations/20260915130000_hq_bulk_inventory/',
      'prisma/migrations/20260917103000_hq_inventory_advisory/',
    ]),
    requiredPaths: Object.freeze([
      'prisma/migrations/20260917103000_hq_inventory_advisory/migration.sql',
      'scripts/ops/deploy-hq-bulk.mjs',
    ]),
  }),
});

export function releasePlan(name) {
  const plan = RELEASE_PLANS[name];
  if (!plan) throw new Error(`Unknown production migration plan: ${name}`);
  return plan;
}
