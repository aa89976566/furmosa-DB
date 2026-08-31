import { snapshotView } from '@/lib/shopify/snapshot-view';
import { OMS_LABELS, parseOmsIssues, type OmsStatus } from '@/lib/orders/oms';

export function ShopifyIntakePanel({ snapshot, status, issues }: {
  snapshot: unknown; status: OmsStatus | null; issues: unknown;
}) {
  const view = snapshotView(snapshot);
  if (!view) return null;
  return <section className="rounded-lg border bg-muted/20 p-4 space-y-3" aria-label="Shopify 收單快照">
    <h2 className="font-medium">Shopify {view.name} · {status ? OMS_LABELS[status] : '來源快照'}</h2>
    <p className="text-sm text-muted-foreground">以下為 Shopify 原始收單內容，保留作為來源紀錄；目前審核進度請以上方狀態為準，配送採用下方已儲存的審核資料。</p>
    <p className="text-sm">收件人：{view.recipient || '缺少'} · 電話：{view.phone || '缺少'}</p>
    <p className="text-sm break-words">地址：{view.address || '請確認配送方式與收件資訊'}</p>
    <p className="text-sm">Shopify 原始總額：{view.currency || '幣別缺失'} {view.total || '金額缺失'}</p>
    <ul className="space-y-2 text-sm">
      {view.items.map((item, index) => <li key={index} className="rounded border p-2 break-words">
        {item.title} · SKU {item.sku || '待補'} · {item.quantity ?? '數量待確認'} 件 · 單價 {item.price || '待確認'}
      </li>)}
    </ul>
    <ul className="space-y-1 text-sm">
      {(parseOmsIssues(issues) ?? []).map((issue, index) => <li className={issue.severity === 'blocking' ? 'text-destructive' : 'text-warning'} key={index}>{issue.message}</li>)}
    </ul>
  </section>;
}
