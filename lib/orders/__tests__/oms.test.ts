import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OMS_STATUSES, OMS_LABELS, parseOmsIssues, omsIssueTone,
  compareShopifySourceVersion, omsApprovalBlockers } from '../oms';

const now = new Date('2026-08-30T10:00:00Z');
const before = new Date('2026-08-30T09:00:00Z');
const after = new Date('2026-08-30T11:00:00Z');
const valid = {
  omsStatus: 'REVIEW' as const, issues: [], checkedAt: now,
  checkedSourceUpdatedAt: before, sourceUpdatedAt: before,
  actorId: 'test-reviewer', actorCanReview: true, cancelled: false,
};

describe('OMS foundation (no database or external effects)', () => {
  it('provides all five stages and staff-facing labels', () => {
    assert.equal(OMS_STATUSES.length, 5);
    for (const status of OMS_STATUSES) assert.ok(OMS_LABELS[status]);
  });
  it('distinguishes unchecked flags from a clean check', () => {
    assert.equal(parseOmsIssues(null), null);
    assert.deepEqual(parseOmsIssues([]), []);
    assert.equal(omsIssueTone([], null), 'yellow');
    assert.equal(omsIssueTone([], now), 'green');
    assert.equal(omsIssueTone([], new Date('invalid')), 'yellow');
  });
  it('does not silently accept corrupt or unrecognized flags', () => {
    for (const value of [{}, [null], ['paid'], [{ code: 'invented', severity: 'warning', message: 'test' }],
      [{ code: 'SKU_MISSING', severity: 'warning', message: '' }]]) {
      assert.equal(parseOmsIssues(value), null);
      assert.notEqual(omsIssueTone(value, now), 'green');
      assert.ok(omsApprovalBlockers({ ...valid, issues: value }).length);
    }
  });
  it('shows warnings yellow and blockers red', () => {
    const issues = [{ code: 'POSSIBLE_DUPLICATE', severity: 'warning', message: '請確認重複下單' }];
    assert.equal(omsIssueTone(issues, now), 'yellow');
    assert.deepEqual(omsApprovalBlockers({ ...valid, issues }), []);
    issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '缺少商品對應' });
    assert.equal(omsIssueTone(issues, now), 'red');
    assert.ok(omsApprovalBlockers({ ...valid, issues }).includes('缺少商品對應'));
  });
  it('orders source timestamps without inventing versions', () => {
    assert.equal(compareShopifySourceVersion(now, before), 'older');
    assert.equal(compareShopifySourceVersion(now, now), 'same');
    assert.equal(compareShopifySourceVersion(now, after), 'newer');
    assert.equal(compareShopifySourceVersion(null, now), 'newer');
    assert.equal(compareShopifySourceVersion(now, null), 'unknown');
    assert.equal(compareShopifySourceVersion(now, new Date('invalid')), 'unknown');
  });
  it('requires an authorized human and a current completed check', () => {
    assert.deepEqual(omsApprovalBlockers(valid), []);
    for (const override of [
      { actorId: null }, { actorCanReview: false }, { checkedAt: null },
      { omsStatus: null }, { omsStatus: 'NEW' as const }, { omsStatus: 'READY' as const },
      { cancelled: true }, { checkedSourceUpdatedAt: null },
      { sourceUpdatedAt: after }, { sourceUpdatedAt: new Date('invalid') },
      { issues: [{ code: 'PAYMENT_PENDING', severity: 'blocking', message: '尚未付款' }] },
    ]) assert.ok(omsApprovalBlockers({ ...valid, ...override }).length);
  });
  it('keeps legacy enrollment nullable and migration additive', () => {
    const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
    assert.match(schema, /omsStatus\s+OmsStatus\?\s+@map/);
    assert.match(schema, /status\s+String\s+@default\("draft"\)/);
    const sql = readFileSync(resolve('prisma/migrations/20260830120000_shopify_oms_foundation/migration.sql'), 'utf8');
    // Match destructive SQL statements, not referential-action clauses such as ON DELETE SET NULL.
    assert.doesNotMatch(sql, /^\s*(?:DROP\b|TRUNCATE\b|DELETE\s+FROM\b|UPDATE\s+"Order"|ALTER\s+COLUMN\b)/im);
    assert.match(sql, /CREATE UNIQUE INDEX "ShopifyWebhookEvent_shopDomain_topic_eventId_key"/);
  });
});
