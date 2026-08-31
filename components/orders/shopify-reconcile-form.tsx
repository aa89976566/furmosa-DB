'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { reconcileOrdersAction, type ReconcileState } from '@/app/(main)/orders/reconcile-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const labels: Record<string, string> = { missing: 'HQ 缺少這筆', matched: '內容一致', different: '內容不同，待同步核對',
  legacy: '舊流程訂單，未自動納入 OMS', created: '已補入 HQ，待審核', saved: '已更新，需依目前狀態處理',
  duplicate: '已存在，沒有重複建立', stale: '來源較舊，未覆蓋', conflict: '來源版本衝突，未覆蓋', failed: '處理失敗，請重試' };
function Controls() {
  const { pending } = useFormStatus();
  return <div className="flex flex-wrap gap-2">
    <Button variant="outline" name="mode" value="inspect" disabled={pending}>檢查漏單（不修改）</Button>
    <Button name="mode" value="sync" disabled={pending}>重新同步至 HQ</Button>
    {pending && <span role="status" className="text-sm">比對中，請稍候…</span>}
  </div>;
}
export function ShopifyReconcileForm() {
  const [state, action] = useFormState(reconcileOrdersAction, { message: '' } as ReconcileState);
  return <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">管理員：Shopify 漏單檢查與補同步</summary>
    <form action={action} className="mt-3 space-y-3">
      <p className="text-xs text-muted-foreground">僅供已確認隔離的測試環境。抓取最近 1～25 筆、不限付款狀態；不是全量盤點，也不會自動建立物流。一般權限僅能讀取近 60 天資料。</p>
      <label className="block max-w-40 text-sm">最近幾筆<Input name="limit" type="number" min={1} max={25} defaultValue={10} required /></label>
      <Controls />
      {state.message && <p role="status" className="text-sm">{state.message}</p>}
      {state.report && <div className="space-y-2 text-sm">
        <p>讀取 {state.report.fetched} 筆，處理 {state.report.processed} 筆。</p>
        {state.report.mode === 'sync' && !state.report.auditRecorded && <p className="text-destructive">同步結束紀錄未寫入，請管理員核對已完成的資料。</p>}
        <ul className="space-y-1">{state.report.rows.map(row => <li key={row.orderId} className="break-all">Shopify ID {row.orderId}：{labels[row.outcome] ?? '需人工確認'}</li>)}</ul>
      </div>}
    </form>
  </details>;
}
