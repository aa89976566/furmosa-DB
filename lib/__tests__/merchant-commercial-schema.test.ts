import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync(
  'prisma/migrations/20260924140000_add_merchant_commercial_terms/migration.sql',
  'utf8',
);

test('merchant commercial schema keeps defaults, modules and order snapshots separate', () => {
  assert.match(schema, /model Product \{[\s\S]*businessTier\s+String\?/);
  assert.match(schema, /model ProductPriceTier \{[\s\S]*defaultWholesaleUnitPrice\s+Int\?/);
  assert.match(schema, /model MerchantCommercialModule \{/);
  assert.match(schema, /model Order \{[\s\S]*merchantOrderMode\s+String\?/);
  assert.match(schema, /model OrderItem \{[\s\S]*commercialRuleSource\s+String\?/);
  assert.match(schema, /commercialOverrideById\s+String\?/);
});

test('standard migration is additive and does not backfill or delete data', () => {
  assert.match(migration, /CREATE TABLE "merchant_commercial_modules"/);
  assert.match(migration, /ADD COLUMN "merchant_order_mode" TEXT/);
  assert.match(migration, /ADD COLUMN "default_wholesale_unit_price" INTEGER/);
  assert.match(migration, /merchant_commercial_modules_period_check/);
  assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE\s+FROM|UPDATE)\b/im);
  assert.doesNotMatch(migration, /\b(?:REAL|DOUBLE PRECISION)\b/i);
});

test('legacy merchant pricing structures remain available during expansion', () => {
  assert.match(schema, /commissionRate\s+Float/);
  assert.match(schema, /model MerchantProductRule \{/);
  assert.match(schema, /model MerchantWholesalePrice \{/);
  assert.match(schema, /types\s+String\[\]/);
});
