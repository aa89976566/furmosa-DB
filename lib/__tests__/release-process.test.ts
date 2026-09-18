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
  assert.doesNotMatch(workflow, /prisma migrate deploy/);
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
  assert.match(script, /omsStatus: null, status: \{ in: \['draft', 'pending_review'\] \}/);
  assert.doesNotMatch(script, /archivedAt: null/);
  assert.doesNotMatch(script, /omsStatus: 'NEW'/);
  assert.doesNotMatch(script, /\.order\.deleteMany|\.order\.delete\(/);
});
