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
  hq_passkeys_20260918: Object.freeze({
    runner: 'scripts/ops/deploy-hq-passkeys.mjs',
    migrationPrefixes: Object.freeze([
      'prisma/migrations/20260918162000_hq_passkeys/',
    ]),
    requiredPaths: Object.freeze([
      'prisma/migrations/20260918162000_hq_passkeys/migration.sql',
    ]),
  }),
  pos_shipment_notifications_20260922: Object.freeze({
    runner: 'scripts/ops/deploy-pos-shipment-notifications.mjs',
    migrationPrefixes: Object.freeze([
      'prisma/migrations/20260922180000_merchant_shipment_notifications/',
    ]),
    requiredPaths: Object.freeze([
      'prisma/migrations/20260922180000_merchant_shipment_notifications/migration.sql',
    ]),
  }),
  historical_hq_schema_repair_20260921: Object.freeze({
    runner: 'scripts/ops/repair-historical-hq-schema-20260921.mjs',
    migrationPrefixes: Object.freeze([]),
    requiredPaths: Object.freeze([
      'docs/releases/historical-hq-schema-repair-20260921.md',
    ]),
  }),
});

export function releasePlan(name) {
  const plan = RELEASE_PLANS[name];
  if (!plan) throw new Error(`Unknown production migration plan: ${name}`);
  return plan;
}
