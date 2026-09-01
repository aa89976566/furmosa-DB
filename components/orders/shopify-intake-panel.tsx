import { snapshotView } from '@/lib/shopify/snapshot-view';
import { OMS_LABELS, parseOmsIssues, type OmsStatus } from '@/lib/orders/oms';

export function ShopifyIntakePanel({ snapshot, status, issues }: {
  snapshot: unknown; status: OmsStatus | null; issues: unknown;
}) {
  const view = snapshotView(snapshot);
  if (!view) return null;
  const issueList = parseOmsIssues(issues) ?? [];
  const blocking = issueList.filter(issue => issue.severity === 'blocking');
  return <section className="space-y-3" aria-label="訂單處理狀態">
    <div className={`rounded-xl border p-4 ${blocking.length ? 'border-destructive/40 bg-destructive/5' : issueList.length ? 'border-warning/40 bg-warning/5' : 'border-success/40 bg-success/5'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">現在要做什麼</p>
          <h2 className="mt-1 text-lg font-semibold">{blocking.length ? `請先處理 ${blocking.length} 個阻擋問題` : issueList.length ? `請確認 ${issueList.length} 個提醒` : status === 'READY' ? '訂單已可進入出貨準備' : '資料正常，可以繼續審核'}</h2>
        </div>
        <span className="rounded-full border bg-background px-3 py-1 text-sm font-medium">{status ? OMS_LABELS[status] : '來源快照'}</span>
      </div>
      {issueList.length ? <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {issueList.map((issue, index) => <li className={`rounded-md bg-background px-3 py-2 text-sm ${issue.severity === 'blocking' ? 'text-destructive' : 'text-warning'}`} key={index}>{issue.message}</li>)}
      </ul> : <p className="mt-2 text-sm text-muted-foreground">系統檢查沒有發現需要阻擋的問題。</p>}
    </div>

    <details className="rounded-lg border bg-muted/10 p-4">
      <summary className="cursor-pointer text-sm font-medium">查看 Shopify 原始訂單資料</summary>
      <div className="mt-3 space-y-3 border-t pt-3">
        <p className="text-xs text-muted-foreground">此區保留 Shopify 收單內容供核對，不代表已完成審核或已送至物流。</p>
        <p className="text-sm">收件人：{view.recipient || '缺少'} · 電話：{view.phone || '缺少'}</p>
        <p className="text-sm break-words">地址：{view.address || '請確認配送方式與收件資訊'}</p>
        <p className="text-sm">原始總額：{view.currency || '幣別缺失'} {view.total || '金額缺失'}</p>
        <ul className="space-y-2 text-sm">
          {view.items.map((item, index) => <li key={index} className="rounded border bg-background p-2 break-words">
            {item.title} · SKU {item.sku || '待補'} · {item.quantity ?? '數量待確認'} 件 · 單價 {item.price || '待確認'}
          </li>)}
        </ul>
      </div>
    </details>
  </section>;
}
