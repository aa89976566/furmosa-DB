import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const targets = JSON.parse(readFileSync(new URL('../config/deployment-targets.json', import.meta.url), 'utf8'));

/** Return only a validated child-process environment; never log connection strings. */
export function previewBuildEnvironment(env) {
  if (env.VERCEL_ENV !== 'preview' || !env.VERCEL_GIT_COMMIT_REF?.trim() || env.VERCEL_GIT_COMMIT_REF.trim() === targets.production.sourceBranch) {
    throw new Error('Preview build requires a non-main Preview deployment');
  }
  const expected = targets.preview.database;
  if (!expected || expected.provider !== 'supabase' || !expected.projectRef || !expected.databaseName) throw new Error('Preview database identity is not configured');
  const databaseUrl = env.DATABASE_URL?.trim() || env.POSTGRES_PRISMA_URL?.trim() || env.POSTGRES_URL?.trim();
  const directUrl = env.DIRECT_URL?.trim() || env.POSTGRES_URL_NON_POOLING?.trim() || databaseUrl;
  for (const value of [databaseUrl, directUrl]) {
    let valid = false;
    try {
      const url = new URL(value);
      const user = decodeURIComponent(url.username);
      const direct = url.hostname === `db.${expected.projectRef}.supabase.co`;
      const pooler = url.hostname.endsWith('.pooler.supabase.com') && user === `postgres.${expected.projectRef}`;
      valid = ['postgres:', 'postgresql:'].includes(url.protocol) &&
        decodeURIComponent(url.pathname) === `/${expected.databaseName}` && (direct || pooler);
    } catch { /* Never include raw URL parse errors or credentials in output. */ }
    if (!valid) throw new Error('Preview database does not match the isolated test project');
  }
  return { ...env, DATABASE_URL: databaseUrl, DIRECT_URL: directUrl };
}

export function runPreviewBuild(env = process.env) {
  const childEnv = previewBuildEnvironment(env);
  const require = createRequire(import.meta.url);
  for (const [entry, args] of [[require.resolve('prisma'), ['generate']], [require.resolve('next/dist/bin/next'), ['build']]]) {
    const result = spawnSync(process.execPath, [entry, ...args], { env: childEnv, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error('Preview compilation failed');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runPreviewBuild(); } catch (error) {
    console.error(error instanceof Error ? error.message : 'Preview build rejected');
    process.exitCode = 1;
  }
}
