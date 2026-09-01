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

const OMS_ACTION_BY_ISSUE: Record<OmsIssueCode, string> = {
  PAYMENT_PENDING: '等待付款', PAYMENT_REFUNDED: '確認退款狀態', ORDER_CANCELLED: '確認取消訂單',
  SKU_MISSING: '補上商品 SKU', PRODUCT_UNMAPPED: '選擇對應商品', STOCK_UNKNOWN: '確認商品庫存',
  STOCK_INSUFFICIENT: '處理庫存不足', SHIPPING_METHOD_UNKNOWN: '選擇配送方式',
  PICKUP_STORE_MISSING: '補上 7-11 門市', TEMPERATURE_UNKNOWN: '確認配送溫層',
  TEMPERATURE_CONFLICT: '確認常溫／冷凍配送', GIFT_REVIEW_REQUIRED: '核對贈品內容',
  RECIPIENT_MISSING: '補上收件人', PHONE_MISSING: '補上聯絡電話', ADDRESS_MISSING: '補上收件地址',
  POSSIBLE_DUPLICATE: '確認是否重複訂單', SOURCE_VERSION_UNKNOWN: '重新同步訂單', ORDER_CHANGED: '重新檢查更新內容',
};

export function omsNextActionLabel(status: OmsStatus | null, issues: unknown) {
  const parsed = parseOmsIssues(issues);
  const issue = parsed?.find((item) => item.severity === 'blocking' && item.code !== 'PAYMENT_PENDING')
    ?? parsed?.find((item) => item.code !== 'PAYMENT_PENDING')
    ?? parsed?.[0];
  if (issue) return OMS_ACTION_BY_ISSUE[issue.code];
  if (status === 'READY') return '建立物流單';
  if (status === 'FULFILLMENT_PENDING') return '確認交寄狀態';
  if (status === 'FULFILLED') return '已完成';
  return '確認訂單內容';
}

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
