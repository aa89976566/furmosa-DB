/** OMS vocabulary only. Legacy status/payment/fulfillment fields remain unchanged. */
export const OMS_STATUSES = ['NEW', 'REVIEW', 'READY', 'FULFILLMENT_PENDING', 'FULFILLED'] as const;
export type OmsStatus = (typeof OMS_STATUSES)[number];

export const OMS_LABELS: Record<OmsStatus, string> = {
  NEW: '新訂單', REVIEW: '待審核', READY: '可出貨',
  FULFILLMENT_PENDING: '待出貨', FULFILLED: '已出貨',
};

export const OMS_ISSUE_CODES = [
  'PAYMENT_PENDING', 'PAYMENT_REFUNDED', 'ORDER_CANCELLED',
  'SKU_MISSING', 'PRODUCT_UNMAPPED', 'STOCK_UNKNOWN', 'STOCK_INSUFFICIENT',
  'SHIPPING_METHOD_UNKNOWN', 'PICKUP_STORE_MISSING',
  'TEMPERATURE_UNKNOWN', 'TEMPERATURE_CONFLICT', 'GIFT_REVIEW_REQUIRED',
  'RECIPIENT_MISSING', 'PHONE_MISSING', 'ADDRESS_MISSING',
  'POSSIBLE_DUPLICATE', 'SOURCE_VERSION_UNKNOWN', 'ORDER_CHANGED',
] as const;
export type OmsIssueCode = (typeof OMS_ISSUE_CODES)[number];
export type OmsIssue = {
  code: OmsIssueCode;
  severity: 'warning' | 'blocking';
  message: string;
  lineItemId?: string;
};

/** Fail closed: malformed or unchecked stored flags must never look like a green check. */
export function parseOmsIssues(value: unknown): OmsIssue[] | null {
  if (!Array.isArray(value)) return null;
  const codes: readonly string[] = OMS_ISSUE_CODES;
  if (!value.every((issue) => issue && typeof issue === 'object' &&
    codes.includes(issue.code) && ['warning', 'blocking'].includes(issue.severity) &&
    typeof issue.message === 'string' && issue.message.trim().length > 0 &&
    (issue.lineItemId === undefined || typeof issue.lineItemId === 'string'))) return null;
  return value as OmsIssue[];
}

export function omsIssueTone(value: unknown, checkedAt: Date | null): 'green' | 'yellow' | 'red' {
  const issues = parseOmsIssues(value);
  if (!checkedAt || !Number.isFinite(checkedAt.getTime()) || !issues) return 'yellow';
  if (issues.some((issue) => issue.severity === 'blocking')) return 'red';
  return issues.length ? 'yellow' : 'green';
}

/** A timestamp is a source ordering signal, not an authorization to approve/ship. */
export function compareShopifySourceVersion(current: Date | null, incoming: Date | null) {
  if (!incoming || !Number.isFinite(incoming.getTime())) return 'unknown' as const;
  if (!current || !Number.isFinite(current.getTime())) return 'newer' as const;
  if (incoming.getTime() < current.getTime()) return 'older' as const;
  if (incoming.getTime() === current.getTime()) return 'same' as const;
  return 'newer' as const;
}

/** Pure precondition helper; callers MUST load trusted values and lock/recheck in a DB transaction. */
export function omsApprovalBlockers(input: {
  omsStatus: OmsStatus | null;
  issues: unknown;
  checkedAt: Date | null;
  checkedSourceUpdatedAt: Date | null;
  sourceUpdatedAt: Date | null;
  actorId: string | null;
  actorCanReview: boolean;
  cancelled: boolean;
}): string[] {
  const blockers: string[] = [];
  if (!input.actorId?.trim() || !input.actorCanReview) blockers.push('需要有審核權限的 HQ 人員確認');
  if (input.omsStatus !== 'REVIEW') blockers.push('訂單不在待審核狀態');
  if (input.cancelled) blockers.push('訂單已取消，不能出貨');
  const issues = parseOmsIssues(input.issues);
  if (!input.checkedAt || !Number.isFinite(input.checkedAt.getTime()) || !issues) {
    blockers.push('尚未完成訂單檢查');
  }
  if (!input.checkedSourceUpdatedAt || !input.sourceUpdatedAt ||
    !Number.isFinite(input.sourceUpdatedAt.getTime()) ||
    input.checkedSourceUpdatedAt.getTime() !== input.sourceUpdatedAt.getTime()) {
    blockers.push('來源版本不明或訂單已更新，請重新檢查');
  }
  blockers.push(...(issues ?? []).filter((issue) => issue.severity === 'blocking').map((issue) => issue.message));
  return blockers;
}
