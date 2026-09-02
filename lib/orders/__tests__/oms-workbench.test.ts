import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { OMS_FILTERS, ORDER_WORK_FILTERS, orderWorkWhere, omsFilterWhere, omsProblemsWhere, taiwanToday, workbenchHref, workbenchVisibleWhere, omsSourceSearchWhere } from '../oms-workbench';
import { OMS_STATUSES } from '../oms';
import { mergeSearchWhere, orderSearchWhere } from '../../site-search';

describe('OMS workbench read-only queries', () => {
  it('has every stage, a problem bucket and a legacy-inclusive all view', () => {
    assert.equal(OMS_FILTERS.length, 7);
    for (const status of OMS_STATUSES) assert.deepEqual(omsFilterWhere(status), { omsStatus: status });
    assert.deepEqual(omsFilterWhere('invalid'), {});
    assert.equal(omsFilterWhere('issues'), omsProblemsWhere);
    assert.deepEqual(workbenchVisibleWhere.OR?.[0], { omsStatus: { not: null } });
    assert.match(JSON.stringify(workbenchVisibleWhere.OR?.[1]), /cancelled/);
  });
  it('daily work buckets are mutually exclusive and use staff-facing labels', () => {
    assert.deepEqual(ORDER_WORK_FILTERS.map((item) => item.label), ['待確認', '等待中', '可出貨', '待交寄', '已完成']);
    assert.deepEqual(orderWorkWhere('now'), { omsStatus: { in: ['NEW', 'REVIEW'] }, paymentStatus: { in: ['paid', 'cod'] } });
    assert.deepEqual(orderWorkWhere('waiting'), { omsStatus: { in: ['NEW', 'REVIEW'] }, paymentStatus: { notIn: ['paid', 'cod'] } });
    assert.deepEqual(orderWorkWhere('ready'), { omsStatus: 'READY' });
    assert.deepEqual(orderWorkWhere('shipping'), { omsStatus: 'FULFILLMENT_PENDING' });
    assert.deepEqual(orderWorkWhere('done'), { omsStatus: 'FULFILLED' });
  });
  it('includes uninspected, null and nonempty issue flags, not only red flags', () => {
    assert.deepEqual(omsProblemsWhere.OR, [{ omsCheckedAt: null },
      { omsIssueFlags: { equals: Prisma.DbNull } }, { omsIssueFlags: { equals: Prisma.JsonNull } },
      { NOT: { omsIssueFlags: { equals: [] } } }]);
  });
  it('uses Taiwan midnight rather than machine timezone, including year rollover', () => {
    const a = taiwanToday(new Date('2026-08-30T15:59:59Z'));
    assert.equal(a.gte.toISOString(), '2026-08-29T16:00:00.000Z');
    assert.equal(a.lt.toISOString(), '2026-08-30T16:00:00.000Z');
    const b = taiwanToday(new Date('2026-12-31T16:00:00Z'));
    assert.equal(b.gte.toISOString(), '2026-12-31T16:00:00.000Z');
    assert.equal(b.lt.toISOString(), '2027-01-01T16:00:00.000Z');
  });
  it('preserves search/source and clears page when switching filters', () => {
    const href = workbenchHref({ source: 'shopify', q: '#123 & 小明', page: '4', oms: 'NEW' }, { oms: 'READY' });
    const params = new URL(href, 'https://test.invalid').searchParams;
    assert.equal(params.get('source'), 'shopify'); assert.equal(params.get('q'), '#123 & 小明');
    assert.equal(params.get('oms'), 'READY'); assert.equal(params.has('page'), false);
  });
  it('search does not remove visibility/OMS filters and supports snapshot recipients', () => {
    const base = { AND: [workbenchVisibleWhere, omsFilterWhere('REVIEW')] };
    const merged = mergeSearchWhere(base, { OR: [orderSearchWhere('小明'), omsSourceSearchWhere('小明')] });
    assert.equal(merged.AND.length, 3); assert.equal(base.AND.length, 2);
    assert.match(JSON.stringify(merged), /shipping_address/);
    assert.match(JSON.stringify(merged), /externalOrderName/);
  });
});
