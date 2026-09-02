import { snapshotView } from '@/lib/shopify/snapshot-view';
import { parseOmsIssues, type OmsIssueCode, type OmsStatus } from '@/lib/orders/oms';

const ISSUE_LABEL: Record<OmsIssueCode, string> = {
  PAYMENT_PENDING: '待付款', PAYMENT_REFUNDED: '退款確認', ORDER_CANCELLED: '訂單取消',
  SKU_MISSING: '缺少 SKU', PRODUCT_UNMAPPED: '商品未對應', STOCK_UNKNOWN: '庫存待確認',
  STOCK_INSUFFICIENT: '庫存不足', SHIPPING_METHOD_UNKNOWN: '配送待確認', PICKUP_STORE_MISSING: '缺門市資料',
  TEMPERATURE_UNKNOWN: '溫層待確認', TEMPERATURE_CONFLICT: '溫層衝突', GIFT_REVIEW_REQUIRED: '贈品待確認',
  RECIPIENT_MISSING: '缺收件人', PHONE_MISSING: '缺電話', ADDRESS_MISSING: '缺地址',
  POSSIBLE_DUPLICATE: '疑似重複', SOURCE_VERSION_UNKNOWN: '同步異常', ORDER_CHANGED: '內容待檢查',
};

export function ShopifyIntakePanel({ snapshot, status, issues }: { snapshot: unknown; status: OmsStatus | null; issues: unknown }) {
  if (!snapshotView(snapshot)) return null;
  const issueList = parseOmsIssues(issues) ?? [];
  const blocking = issueList.filter(issue => issue.severity === 'blocking');
  const unique = issueList.filter((issue, index) => issueList.findIndex(item => item.code === issue.code) === index);
  return <section className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${blocking.length ? 'border-destructive/30 bg-destructive/5' : issueList.length ? 'border-warning/30 bg-warning/5' : 'border-success/30 bg-success/5'}`} aria-label="訂單處理狀態">
    <p className="shrink-0 text-sm font-semibold">{blocking.length ? '需要處理' : status === 'READY' ? '可以建立出貨單' : '資料已通過檢查'}</p>
    <div className="flex flex-wrap gap-1.5">
      {unique.length ? unique.map(issue => <span title={issue.message} className={`rounded-full border bg-background px-2.5 py-1 text-xs font-medium ${issue.severity === 'blocking' ? 'border-destructive/25 text-destructive' : 'border-warning/25 text-warning'}`} key={issue.code}>{ISSUE_LABEL[issue.code]}</span>) : <span className="rounded-full border border-success/25 bg-background px-2.5 py-1 text-xs font-medium text-success">資料完整</span>}
    </div>
  </section>;
}
