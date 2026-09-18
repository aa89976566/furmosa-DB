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
