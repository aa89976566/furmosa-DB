import { appendFileSync } from 'node:fs';
import { releasePlan } from './release-plans.mjs';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const token = required('GITHUB_TOKEN');
const repository = required('GITHUB_REPOSITORY');
const prNumber = required('RELEASE_PR_NUMBER');
const expectedHead = required('RELEASE_EXPECTED_HEAD_SHA').toLowerCase();
const planName = required('RELEASE_MIGRATION_PLAN');
const output = required('GITHUB_OUTPUT');
const plan = releasePlan(planName);
const apiBase = `https://api.github.com/repos/${repository}`;

async function github(path) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'furmosa-production-release',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub API ${path} failed (${response.status})`);
  return response.json();
}

const pr = await github(`/pulls/${encodeURIComponent(prNumber)}`);
const alreadyMerged = pr.state === 'closed' && Boolean(pr.merged_at) && Boolean(pr.merge_commit_sha);
if (!alreadyMerged && (pr.state !== 'open' || pr.draft)) {
  throw new Error('PR must be open and ready for review, or already merged into main');
}
if (pr.base?.ref !== 'main') throw new Error('Production PR base must be main');
if (String(pr.head?.sha).toLowerCase() !== expectedHead) {
  throw new Error('PR head moved; restart with the new full expected head SHA');
}
if (!/^[0-9a-f]{40}$/.test(expectedHead)) throw new Error('Expected head SHA must contain 40 hex characters');

if (alreadyMerged) {
  const comparison = await github(`/compare/${encodeURIComponent(pr.merge_commit_sha)}...main`);
  if (!['ahead', 'identical'].includes(comparison.status)) {
    throw new Error('Merged PR commit is not contained in current main');
  }
}

const checkPayload = await github(`/commits/${expectedHead}/check-runs?per_page=100`);
const verifyChecks = (checkPayload.check_runs ?? []).filter((check) => check.name === 'verify');
const verify = verifyChecks.sort((a, b) => Date.parse(b.completed_at ?? 0) - Date.parse(a.completed_at ?? 0))[0];
if (!verify || verify.status !== 'completed' || verify.conclusion !== 'success') {
  throw new Error('Required CI check verify has not succeeded for the exact PR head');
}

const files = [];
for (let page = 1; ; page += 1) {
  const batch = await github(`/pulls/${encodeURIComponent(prNumber)}/files?per_page=100&page=${page}`);
  files.push(...batch.map((file) => file.filename));
  if (batch.length < 100) break;
}
const protectedControllerPaths = [
  '.github/workflows/deploy-production.yml',
  'vercel.json',
  'scripts/vercel-ignore-build.mjs',
];
const changesReleaseController = files.some(
  (path) => protectedControllerPaths.includes(path) || path.startsWith('scripts/release/'),
);
if (changesReleaseController) {
  throw new Error('Production PR must not modify the trusted release controller');
}
const changedMigrations = files.filter((path) => path.startsWith('prisma/migrations/'));
if (planName === 'none' && changedMigrations.length > 0) {
  throw new Error('PR changes migrations but migration_plan is none');
}
for (const path of changedMigrations) {
  if (!plan.migrationPrefixes.some((prefix) => path.startsWith(prefix))) {
    throw new Error(`Migration is outside the selected production plan: ${path}`);
  }
}
for (const path of plan.requiredPaths) {
  if (!files.includes(path)) throw new Error(`Selected migration plan requires PR path: ${path}`);
}

appendFileSync(output, `head_sha=${expectedHead}\n`);
appendFileSync(output, `migration_runner=${plan.runner ?? ''}\n`);
appendFileSync(output, `pr_title=${String(pr.title).replace(/[\r\n]/g, ' ')}\n`);
appendFileSync(output, `already_merged=${alreadyMerged}\n`);
appendFileSync(output, `merge_sha=${alreadyMerged ? pr.merge_commit_sha : ''}\n`);
console.log(`Release preflight passed for PR #${prNumber} at ${expectedHead}`);
