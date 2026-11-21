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
  assert.equal(RELEASE_PLANS.standard.runner, 'scripts/release/deploy-standard-migrations.mjs');
  assert.deepEqual(RELEASE_PLANS.standard.migrationPrefixes, ['prisma/migrations/']);
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
  assert.match(workflow, /- standard/);
  assert.match(workflow, /RELEASE_MIGRATION_PATHS/);
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

test('standard plan is bounded to exact non-destructive PR migrations', () => {
  const preflight = readFileSync('scripts/release/verify-pr.mjs', 'utf8');
  const runner = readFileSync('scripts/release/deploy-standard-migrations.mjs', 'utf8');

  assert.match(preflight, /Standard migration plan only accepts migration\.sql files/);
  assert.match(preflight, /DROP\\s\+\(\?:TABLE\|SCHEMA\|DATABASE\|TYPE\|FUNCTION\)/);
  assert.match(preflight, /DELETE\\s\+FROM/);
  assert.match(preflight, /migration_paths=/);
  assert.match(runner, /RELEASE_MIGRATION_PATHS/);
  assert.match(runner, /checksum\/history differs/);
  assert.match(runner, /BEGIN;[\s\S]*COMMIT;/);
  assert.doesNotMatch(runner, /prisma migrate deploy/);
});

test('Vercel builds feature previews and skips main, production and unknown refs', () => {
  const script = 'scripts/vercel-ignore-build.mjs';
  const run = (ref: string, environment: string) => spawnSync(process.execPath, [script], { env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref, VERCEL_ENV: environment } }).status;
  assert.equal(run('main', 'preview'), 0);
  assert.equal(run('main', 'production'), 0);
  assert.equal(run('feature/test', 'preview'), 1);
  assert.equal(run('feature/test', 'production'), 0);
  assert.equal(run('feature/test', ''), 0);
  assert.equal(run('', 'preview'), 0);
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


// Run the real controller with synthetic API responses: no GitHub/DB access.
function preflightFixture(options: {
  status?: string; behind?: number; merged?: boolean;
  checks?: Array<Record<string, unknown>>; secondPage?: Array<Record<string, unknown>>;
  files?: string[];
}) {
  const harness = `
    import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
    import { tmpdir } from 'node:os';
    import { join } from 'node:path';
    import { pathToFileURL } from 'node:url';
    const fixture = JSON.parse(process.env.AUDIT_FIXTURE);
    const folder = mkdtempSync(join(tmpdir(), 'release-preflight-test-'));
    const output = join(folder, 'output');
    Object.assign(process.env, {
      GITHUB_TOKEN: 'synthetic', GITHUB_REPOSITORY: 'fixture/repo',
      RELEASE_PR_NUMBER: '1', RELEASE_EXPECTED_HEAD_SHA: 'a'.repeat(40),
      RELEASE_MIGRATION_PLAN: 'none', GITHUB_OUTPUT: output,
    });
    const requests = [];
    globalThis.fetch = async url => {
      const u = new URL(url); requests.push(u.pathname + u.search);
      let data;
      if (u.pathname.endsWith('/pulls/1')) data = {
        state: fixture.merged ? 'closed' : 'open', draft: false,
        merged_at: fixture.merged ? '2026-11-09' : null,
        merge_commit_sha: fixture.merged ? 'b'.repeat(40) : null,
        base: { ref: 'main' }, head: { sha: 'a'.repeat(40) }, title: 'Fixture',
      };
      else if (u.pathname.includes('/compare/')) data = {
        status: fixture.status ?? 'ahead', behind_by: fixture.behind ?? 0,
      };
      else if (u.pathname.endsWith('/check-runs')) data = {
        check_runs: u.searchParams.get('page') === '2' ? (fixture.secondPage ?? []) :
          (fixture.checks ?? [{ id: 1, name: 'verify', status: 'completed', conclusion: 'success' }]),
      };
      else if (u.pathname.endsWith('/files')) data = (fixture.files ?? []).map(filename => ({ filename }));
      else throw new Error('Unexpected mock endpoint');
      return { ok: true, json: async () => data };
    };
    try {
      const source = readFileSync('scripts/release/verify-pr.mjs', 'utf8').replace(
        "'./release-plans.mjs'", JSON.stringify(pathToFileURL(join(process.cwd(), 'scripts/release/release-plans.mjs')).href));
      await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
      console.log(JSON.stringify({ ok: true, requests, output: readFileSync(output, 'utf8') }));
    } catch (error) {
      console.log(JSON.stringify({ ok: false, requests, error: error.message, wroteOutput: existsSync(output) }));
    } finally { rmSync(folder, { recursive: true, force: true }); }
  `;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', harness], {
    encoding: 'utf8', env: { AUDIT_FIXTURE: JSON.stringify(options) },
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout.trim().split('\n').at(-1)!);
}

test('open release candidates must include live main; merged recovery keeps ancestry checks', () => {
  for (const status of ['behind', 'diverged']) {
    const result = preflightFixture({ status, behind: 1 });
    assert.equal(result.ok, false);
    assert.match(result.error, /behind or diverged/);
    assert.equal(result.wroteOutput, false);
  }
  assert.equal(preflightFixture({ status: 'ahead', behind: 1 }).ok, false);
  for (const status of ['ahead', 'identical']) {
    const result = preflightFixture({ status });
    assert.equal(result.ok, true);
    assert.ok(result.requests.some((path: string) => path.includes('/compare/main...')));
    assert.equal(preflightFixture({ status, merged: true }).ok, true);
  }
  assert.equal(preflightFixture({ status: 'diverged', merged: true }).ok, false);
});

test('new verify attempts cannot inherit an older successful result', () => {
  const old = { id: 10, name: 'verify', status: 'completed', conclusion: 'success', completed_at: '2026-11-09T12:00:00Z' };
  for (const status of ['queued', 'in_progress', 'completed']) {
    const newest = { id: 11, name: 'verify', status, conclusion: status === 'completed' ? 'failure' : null, completed_at: null };
    for (const checks of [[old, newest], [newest, old]]) {
      const result = preflightFixture({ checks });
      assert.equal(result.ok, false);
      assert.equal(result.wroteOutput, false);
    }
  }
  assert.equal(preflightFixture({ checks: [old, { ...old, id: 11, completed_at: '2026-11-09T11:00:00Z' }] }).ok, true);
  assert.equal(preflightFixture({ checks: [] }).ok, false);
  assert.equal(preflightFixture({ checks: [{ ...old, id: null }] }).ok, false);
});

test('verify selection reads every API page and preserves controller protection', () => {
  const checks = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: 'other', status: 'completed', conclusion: 'success' }));
  const result = preflightFixture({ checks, secondPage: [{ id: 101, name: 'verify', status: 'in_progress' }] });
  assert.equal(result.ok, false);
  assert.ok(result.requests.some((path: string) => path.includes('filter=all&per_page=100&page=2')));
  const protectedResult = preflightFixture({ files: ['scripts/release/verify-pr.mjs'] });
  assert.equal(protectedResult.ok, false);
  assert.match(protectedResult.error, /must not modify the trusted release controller/);
});
