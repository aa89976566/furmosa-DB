import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const targets = JSON.parse(read('config/deployment-targets.json'));

assert.equal(targets.schemaVersion, 1, 'Unsupported deployment contract schema');
assert.deepEqual(
  targets.production,
  {
    platform: 'railway',
    service: 'furmosa-hq',
    sourceBranch: 'main',
    origin: 'https://furmosa-hq-production.up.railway.app',
    releaseWorkflow: '.github/workflows/deploy-production.yml',
  },
  'Production must remain the approved Railway service deployed from main',
);
assert.deepEqual(
  targets.preview,
  {
    platform: 'vercel',
    productionAllowed: false,
    productionDatabaseAllowed: false,
    mainBuildAllowed: false,
  },
  'Vercel must remain preview-only and isolated from production data',
);
assert.equal(targets.database.productionPlatform, 'supabase-postgresql');

const deploymentGuide = read('DEPLOY.md');
const agentRules = read('AGENTS.md');
const claudeRules = read('CLAUDE.md');
const cursorRules = read('.cursor/rules/claude-cursor-gated-workflow.mdc');
const productionWorkflow = read(targets.production.releaseWorkflow);

for (const [name, text] of [
  ['DEPLOY.md', deploymentGuide],
  ['AGENTS.md', agentRules],
  ['CLAUDE.md', claudeRules],
  ['Cursor rules', cursorRules],
]) {
  assert.match(text, /config\/deployment-targets\.json/, `${name} must point to the deployment contract`);
}

assert.match(productionWorkflow, /environment:\s*\n\s*name: production/);
assert.match(productionWorkflow, /PRODUCTION_ORIGIN:\s*\$\{\{ vars\.PRODUCTION_ORIGIN \}\}/);
assert.match(productionWorkflow, /wait-railway-status\.mjs/);
assert.doesNotMatch(productionWorkflow, /vercel\s+(--prod|deploy)/i);

const runVercelGate = (ref) =>
  spawnSync(process.execPath, ['scripts/vercel-ignore-build.mjs'], {
    cwd: new URL('../..', import.meta.url),
    env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref },
    stdio: 'ignore',
  }).status;

assert.equal(runVercelGate('main'), 0, 'Vercel must skip main');
assert.equal(runVercelGate('preview/example'), 1, 'Vercel must allow non-main previews');

console.log('Deployment contract verified: Railway production, Vercel preview-only.');
