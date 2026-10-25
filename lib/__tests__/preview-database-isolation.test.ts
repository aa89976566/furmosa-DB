import assert from 'node:assert/strict';
import test from 'node:test';
import { previewBuildEnvironment } from '../../scripts/vercel-preview-build.mjs';

const ref = 'psbaygunjtekphtbzbcl';
const base = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/test' };
const direct = `postgresql://postgres:test@db.${ref}.supabase.co:5432/postgres`;
const pooled = `postgresql://postgres.${ref}:test@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
test('Preview accepts the isolated project through direct and pooled URLs', () => {
  const result = previewBuildEnvironment({ ...base, POSTGRES_PRISMA_URL: pooled, POSTGRES_URL_NON_POOLING: direct });
  assert.equal(result.DATABASE_URL,pooled);
  assert.equal(result.DIRECT_URL,direct);
});
test('Preview rejects unknown projects, conflicting overrides and lookalike hosts', () => {
  const bad = [direct.replace(ref,'production-project'),direct.replace(':5432/postgres',':5432/other'),direct.replace('.supabase.co','.supabase.co.attacker.example'),pooled.replace(ref,'other'), 'invalid-secret-connection'];
  for (const url of bad) {
    assert.throws(() => previewBuildEnvironment({...base,DATABASE_URL:url}),/does not match/);
    assert.throws(() => previewBuildEnvironment({...base,DATABASE_URL:direct,DIRECT_URL:url}),/does not match/);
  }
  assert.throws(() => previewBuildEnvironment({...base,DATABASE_URL:bad[0],POSTGRES_URL:direct}),/does not match/);
});
test('Preview fails closed for missing URLs, main and production; errors do not reveal credentials', () => {
  for (const env of [{...base}, {...base,DATABASE_URL:direct,VERCEL_ENV:'production'}, {...base,DATABASE_URL:direct,VERCEL_GIT_COMMIT_REF:'main'}]) assert.throws(() => previewBuildEnvironment(env));
  const secret = 'DO_NOT_PRINT_THIS';
  try { previewBuildEnvironment({...base,DATABASE_URL:`postgresql://postgres:${secret}@wrong.example/postgres`});assert.fail('must reject'); }
  catch (error) { assert.ok(error instanceof Error);assert.ok(!error.message.includes(secret));assert.ok(!error.message.includes('postgresql://')); }
});
