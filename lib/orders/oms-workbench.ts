import { Prisma } from '@prisma/client';
import { OMS_STATUSES, OMS_LABELS, type OmsStatus } from './oms';
import { activeOrderWhere } from '../order-list';
import { hrefWithPage } from '../list-pagination';

export const OMS_FILTERS = [
  { key: '', label: '所有訂單' },
  ...OMS_STATUSES.slice(0, 2).map(key => ({ key, label: OMS_LABELS[key] })),
  { key: 'issues', label: '需要處理' },
  ...OMS_STATUSES.slice(2).map(key => ({ key, label: OMS_LABELS[key] })),
];

export const ORDER_WORK_FILTERS = [
  { key: 'now', label: '待確認' },
  { key: 'waiting', label: '等待中' },
  { key: 'ready', label: '可出貨' },
  { key: 'shipping', label: '待交寄' },
  { key: 'done', label: '已完成' },
] as const;

/** Mutually exclusive daily-work buckets. One OMS order belongs to exactly one bucket. */
export function orderWorkWhere(value?: string): Prisma.OrderWhereInput {
  if (value === 'now') return { omsStatus: { in: ['NEW', 'REVIEW'] }, paymentStatus: { in: ['paid', 'cod'] } };
  if (value === 'waiting') return { omsStatus: { in: ['NEW', 'REVIEW'] }, paymentStatus: { notIn: ['paid', 'cod'] } };
  if (value === 'ready') return { omsStatus: 'READY' };
  if (value === 'shipping') return { omsStatus: 'FULFILLMENT_PENDING' };
  if (value === 'done') return { omsStatus: 'FULFILLED' };
  return {};
}

/** Every enrolled order stays visible, including cancelled/refunded exceptions. Legacy behavior is unchanged. */
export const workbenchVisibleWhere: Prisma.OrderWhereInput = {
  deletedAt: null,
  OR: [{ omsStatus: { not: null } }, { AND: [{ omsStatus: null }, activeOrderWhere] }],
};
/** Conservative problem bucket includes warnings and incomplete checks, not only red blockers. */
export const omsProblemsWhere: Prisma.OrderWhereInput = {
  deletedAt: null,
  omsStatus: { not: null },
  OR: [ { omsCheckedAt: null }, { omsIssueFlags: { equals: Prisma.DbNull } },
    { omsIssueFlags: { equals: Prisma.JsonNull } }, { NOT: { omsIssueFlags: { equals: [] } } } ],
};

export function omsFilterWhere(value?: string): Prisma.OrderWhereInput {
  if (value === 'issues') return omsProblemsWhere;
  if ((OMS_STATUSES as readonly string[]).includes(value ?? '')) return { omsStatus: value as OmsStatus };
  return {};
}

/** Taiwan business day, independent of server/user timezone. Taiwan has no DST. */
export function taiwanToday(now = new Date()) {
  const shifted = new Date(now.getTime() + 8 * 3600000);
  const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 3600000);
  return { gte: start, lt: new Date(start.getTime() + 86400000) };
}

export function workbenchHref(current: Record<string, string | undefined>, changes: Record<string, string | undefined>) {
  return hrefWithPage('/orders', { ...current, ...changes, page: undefined }, 1);
}

export function omsSourceSearchWhere(query: string): Prisma.OrderWhereInput {
  return { omsStatus: { not: null }, OR: [
    { externalOrderName: { contains: query, mode: 'insensitive' } },
    ...[['order', 'shipping_address', 'name'], ['order', 'shipping_address', 'phone'],
      ['order', 'customer', 'first_name'], ['order', 'customer', 'last_name'], ['order', 'email']]
      .map(path => ({ shopifySnapshot: { path, string_contains: query } })),
  ] };
}
