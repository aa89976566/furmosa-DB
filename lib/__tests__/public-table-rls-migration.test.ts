import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../../prisma/migrations/20261106220000_secure_public_server_tables/migration.sql', import.meta.url),
  'utf8',
);

const serverOnlyTables = [
  'merchant_notifications',
  'merchant_notification_reads',
  'store_settlement_items',
  'merchant_balance_entries',
  'automation_jobs',
  'purchase_receipts',
  'purchase_receipt_items',
  'purchase_receipt_attachments',
  'purchase_orders',
  'purchase_order_items',
  'purchase_order_attachments',
  'stocktake_adjustments',
  'merchant_commercial_modules',
  'partner_applications',
  'task_attachments',
  'shopify_catalog_candidates',
  'vendor_settlements',
  'vendor_settlement_items',
] as const;

test('server-only public tables enable RLS and revoke both Supabase API roles', () => {
  for (const table of serverOnlyTables) {
    assert.equal(
      (migration.match(new RegExp(`'${table}'`, 'g')) ?? []).length,
      1,
      `${table} must appear exactly once in the guarded table list`,
    );
  }

  assert.match(migration, /to_regclass\(format\('public\.%I', table_name\)\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /rolname = 'anon'/);
  assert.match(migration, /rolname = 'authenticated'/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.%I FROM anon/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.%I FROM authenticated/);
  assert.doesNotMatch(migration, /CREATE POLICY|GRANT\s+/i);
});
