import test from 'node:test';
import assert from 'node:assert/strict';
import { previewLoginDiagnostic } from '../login-diagnostics';

const ref = 'isolated-test';
test('production and unset environments emit no diagnostic', () => {
  for (const VERCEL_ENV of [undefined, 'production', 'development'])
    assert.equal(previewLoginDiagnostic('PASSWORD_MISMATCH', { VERCEL_ENV }, ref), null);
});
test('diagnostic validates direct and pooled isolated identities', () => {
  for (const DATABASE_URL of [
    'postgresql://private:private@db.isolated-test.supabase.co/postgres',
    'postgres://postgres.isolated-test:private@aws-0.pooler.supabase.com/postgres',
  ]) assert.equal(previewLoginDiagnostic('ACCOUNT_NOT_FOUND', { VERCEL_ENV: 'preview', DATABASE_URL }, ref)?.isolatedDatabaseMatches, true);
});
test('wrong database, project, scheme and malformed URLs fail closed', () => {
  for (const DATABASE_URL of [
    'postgres://private:private@db.other.supabase.co/postgres',
    'postgres://private:private@db.isolated-test.supabase.co/other',
    'https://db.isolated-test.supabase.co/postgres', 'private-invalid',
    'postgres://postgres.other:private@aws-0.pooler.supabase.com/postgres',
  ]) assert.equal(previewLoginDiagnostic('PASSWORD_MISMATCH', { VERCEL_ENV: 'preview', DATABASE_URL }, ref)?.isolatedDatabaseMatches, false);
});
test('runtime URL precedence and fallback match Prisma', () => {
  assert.equal(previewLoginDiagnostic('AUTHENTICATED', {
    VERCEL_ENV: 'preview', DATABASE_URL: 'invalid',
    POSTGRES_PRISMA_URL: 'postgres://private@db.isolated-test.supabase.co/postgres',
  }, ref)?.isolatedDatabaseMatches, false);
  assert.equal(previewLoginDiagnostic('AUTHENTICATED', {
    VERCEL_ENV: 'preview', DATABASE_URL: ' ',
    POSTGRES_PRISMA_URL: 'postgres://private@db.isolated-test.supabase.co/postgres',
  }, ref)?.isolatedDatabaseMatches, true);
});
test('serialized output contains only fixed codes and a boolean', () => {
  for (const stage of ['ACCOUNT_NOT_FOUND', 'ACCOUNT_INACTIVE', 'PASSWORD_MISMATCH', 'AUTHENTICATED'] as const) {
    assert.deepEqual(previewLoginDiagnostic(stage, {
      VERCEL_ENV: 'preview',
      DATABASE_URL: 'postgres://private-user:private-password@db.isolated-test.supabase.co/postgres',
    }, ref), { code: 'POS_PREVIEW_LOGIN_DIAGNOSTIC', stage, isolatedDatabaseMatches: true });
  }
});
