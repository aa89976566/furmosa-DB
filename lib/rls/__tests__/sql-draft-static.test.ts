import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  RLS_DRAFT_MIGRATION_PATH,
  RLS_DRAFT_ROLLBACK_PATH,
  RLS_PLACEHOLDER_RUNTIME_ROLE,
} from '@/lib/rls/constants';

describe('RLS SQL draft static checks (no remote DB)', () => {
  const sql = readFileSync(RLS_DRAFT_MIGRATION_PATH, 'utf8');
  const rollback = readFileSync(RLS_DRAFT_ROLLBACK_PATH, 'utf8');

  it('enables RLS on 51 business tables and never touches system schemas', () => {
    const enables = sql.match(/ENABLE ROW LEVEL SECURITY/g) ?? [];
    assert.equal(enables.length, 51);
    assert.equal(/\b(CREATE|ALTER|DROP|GRANT|REVOKE)\b[\s\S]{0,40}\bauth\./i.test(sql), false);
    assert.equal(/\b(CREATE|ALTER|DROP|GRANT|REVOKE)\b[\s\S]{0,40}\bstorage\./i.test(sql), false);
    assert.equal(/ALTER TABLE\s+"_prisma_migrations"/i.test(sql), false);
    assert.equal(/FORCE ROW LEVEL SECURITY/i.test(sql), false);
  });

  it('revokes PostgREST anon/authenticated and grants only placeholder runtime', () => {
    assert.match(sql, /REVOKE ALL ON TABLE .+ FROM anon/);
    assert.match(sql, /REVOKE ALL ON TABLE .+ FROM authenticated/);
    assert.match(sql, new RegExp(`TO "${RLS_PLACEHOLDER_RUNTIME_ROLE}"`));
    assert.match(sql, /NOBYPASSRLS/);
  });

  it('contains no passwords, connection strings, or service_role client secrets', () => {
    // Allow the word PASSWORD only in instructional comments, never as SQL with a literal.
    assert.equal(/PASSWORD\s+'[^']+'/i.test(sql), false);
    assert.equal(/PASSWORD\s+"[^"]+"/i.test(sql), false);
    assert.equal(/postgresql:\/\//i.test(sql), false);
    assert.equal(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i.test(sql), false);
    assert.equal(/service_role\s*=/i.test(sql), false);
  });

  it('rollback disables RLS and does not delete business rows', () => {
    const disables = rollback.match(/DISABLE ROW LEVEL SECURITY/g) ?? [];
    assert.equal(disables.length, 51);
    assert.equal(/\bDELETE\s+FROM\b/i.test(rollback), false);
    assert.equal(/\bTRUNCATE\b/i.test(rollback), false);
    assert.equal(/\bDROP TABLE\b/i.test(rollback), false);
  });

  it('documents Phase 2 claim helpers without using them in Phase 1 policies', () => {
    assert.match(sql, /app_rls\.current_merchant_id/);
    assert.match(sql, /USING \(true\)/);
    assert.match(sql, /Does NOT implement per-merchant/);
  });
});
