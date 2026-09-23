import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { RELEASE_PLANS } from '../../scripts/release/release-plans.mjs';

test('production workflow is manual, protected and waits for Railway exact commit status', () => {
  const workflow = readFileSync('.github/workflows/deploy-production.yml', 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment:\s*\n\s*name: production/);
  assert.match(workflow, /RELEASE_EXPECTED_HEAD_SHA/);
  assert.match(workflow, /wait-railway-status\.mjs/);
  assert.match(workflow, /production-readiness\.mjs/);
  assert.match(workflow, /steps\.preflight\.outputs\.already_merged != 'true'/);
  assert.match(workflow, /steps\.preflight\.outputs\.merge_sha/);
  assert.match(
    workflow,
    /Keep release controller changes separate[\s\S]*if: steps\.preflight\.outputs\.already_merged != 'true'/,
  );
  assert.doesNotMatch(workflow, /prisma migrate deploy/);

  const preflight = readFileSync('scripts/release/verify-pr.mjs', 'utf8');
  assert.match(preflight, /already merged into main/);
  assert.match(preflight, /Merged PR commit is not contained in current main/);
  assert.match(preflight, /already_merged=/);
  assert.match(preflight, /Production PR must not modify the trusted release controller/);
  assert.match(preflight, /path\.startsWith\('scripts\/release\/'\)/);
});

test('none plan rejects migrations by contract and HQ plan stays bounded', () => {
  assert.deepEqual(RELEASE_PLANS.none.migrationPrefixes, []);
  assert.equal(RELEASE_PLANS.hq_inventory_advisory_20260917.runner, 'scripts/ops/deploy-hq-bulk.mjs');
  assert.deepEqual(RELEASE_PLANS.hq_inventory_advisory_20260917.migrationPrefixes, [
    'prisma/migrations/20260915130000_hq_bulk_inventory/',
    'prisma/migrations/20260917103000_hq_inventory_advisory/',
  ]);
  assert.equal(RELEASE_PLANS.hq_passkeys_20260918.runner, 'scripts/ops/deploy-hq-passkeys.mjs');
  assert.deepEqual(RELEASE_PLANS.hq_passkeys_20260918.migrationPrefixes, [
    'prisma/migrations/20260918162000_hq_passkeys/',
  ]);
  assert.deepEqual(RELEASE_PLANS.hq_passkeys_20260918.requiredPaths, [
    'prisma/migrations/20260918162000_hq_passkeys/migration.sql',
  ]);
  const workflow = readFileSync('.github/workflows/deploy-production.yml', 'utf8');
  assert.match(workflow, /- hq_passkeys_20260918/);
  assert.equal(
    RELEASE_PLANS.pos_shipment_notifications_20260922.runner,
    'scripts/ops/deploy-pos-shipment-notifications.mjs',
  );
  assert.deepEqual(
    RELEASE_PLANS.pos_shipment_notifications_20260922.migrationPrefixes,
    ['prisma/migrations/20260922180000_merchant_shipment_notifications/'],
  );
  assert.deepEqual(
    RELEASE_PLANS.pos_shipment_notifications_20260922.requiredPaths,
    ['prisma/migrations/20260922180000_merchant_shipment_notifications/migration.sql'],
  );
  assert.match(workflow, /- pos_shipment_notifications_20260922/);
  const notificationRunner = readFileSync(
    'scripts/ops/deploy-pos-shipment-notifications.mjs',
    'utf8',
  );
  assert.match(notificationRunner, /20260922180000_merchant_shipment_notifications/);
  assert.match(notificationRunner, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(notificationRunner, /checksum\/history differs/);
  assert.doesNotMatch(notificationRunner, /prisma migrate deploy/);
  assert.equal(
    RELEASE_PLANS.historical_hq_schema_repair_20260921.runner,
    'scripts/ops/repair-historical-hq-schema-20260921.mjs',
  );
  assert.deepEqual(RELEASE_PLANS.historical_hq_schema_repair_20260921.migrationPrefixes, []);
  assert.deepEqual(RELEASE_PLANS.historical_hq_schema_repair_20260921.requiredPaths, [
    'docs/releases/historical-hq-schema-repair-20260921.md',
  ]);
  assert.match(workflow, /- historical_hq_schema_repair_20260921/);
});

test('Vercel skips main and builds PR branches', () => {
  const script = 'scripts/vercel-ignore-build.mjs';
  const main = spawnSync(process.execPath, [script], { env: { ...process.env, VERCEL_GIT_COMMIT_REF: 'main' } });
  const preview = spawnSync(process.execPath, [script], { env: { ...process.env, VERCEL_GIT_COMMIT_REF: 'feature/test' } });
  assert.equal(main.status, 0);
  assert.equal(preview.status, 1);
});

test('shared deployment contract stays valid for every agent and release', () => {
  const verification = spawnSync(process.execPath, ['scripts/verify-deployment-contract.mjs'], {
    encoding: 'utf8',
  });
  assert.equal(verification.status, 0, verification.stderr || verification.stdout);
});

test('pending Shopify cleanup is bounded, digest-locked and preserves source identity', () => {
  const workflow = readFileSync('.github/workflows/remove-pending-shopify-orders.yml', 'utf8');
  const script = readFileSync('scripts/ops/remove-current-pending-shopify-orders.mjs', 'utf8');
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /expected_digest/);
  assert.match(script, /expectedCount = 15/);
  assert.match(script, /pending-order set changed/);
  assert.match(script, /deletedAt: removedAt/);
  assert.match(script, /shopifySourcePreserved: true/);
  assert.match(script, /new Set\(\['admin', 'staff', 'finance', 'warehouse'\]\)/);
  assert.match(script, /executionMode: 'protected-production-workflow'/);
  assert.match(script, /omsStatus: \{ in: \['NEW', 'REVIEW'\] \}/);
  assert.doesNotMatch(script, /omsStatus: null/);
  assert.doesNotMatch(script, /archivedAt: null/);
  assert.doesNotMatch(script, /omsStatus: 'NEW'/);
  assert.doesNotMatch(script, /\.order\.deleteMany|\.order\.delete\(/);
});
