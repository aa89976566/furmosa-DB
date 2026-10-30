import { saveOrderCancellationNote } from '@/app/(main)/orders/actions';
import { Button } from '@/components/ui/button';
import { ORDER_CANCELLATION_REASONS, type OrderCancellationRecord } from '@/lib/orders/cancellation-reasons';
import { formatDateTime } from '@/lib/format';

type RecordWithTime = OrderCancellationRecord & { id: string; createdAt: Date };

export function OrderCancellationPanel({ orderId, records }: { orderId: string; records: RecordWithTime[] }) {
  return (
    <section className="rounded-xl border border-destructive/25 bg-destructive/[0.025] p-5">
      <div>
        <h2 className="font-semibold">取消原因與內部備註</h2>
        <p className="mt-1 text-sm text-muted-foreground">只供 HQ 人員查看；新增內容會保留在歷程中，不會覆蓋先前紀錄。</p>
      </div>

      {records.length ? (
        <ol className="mt-4 space-y-3">
          {records.map((record) => (
            <li key={record.id} className="rounded-lg border bg-card px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{record.reasonLabel}</p>
                <p className="text-xs text-muted-foreground">{record.actorName} · {formatDateTime(record.createdAt)}</p>
              </div>
              {record.note ? <p className="mt-2 whitespace-pre-wrap leading-6">{record.note}</p> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">尚未登記取消原因。</p>
      )}

      <form action={saveOrderCancellationNote} className="mt-5 grid gap-3 rounded-lg border bg-card p-4">
        <input type="hidden" name="orderId" value={orderId} />
        <label className="grid gap-1.5 text-sm font-medium">
          取消原因
          <select name="reasonCode" required defaultValue="" className="min-h-11 rounded-md border bg-background px-3 font-normal">
            <option value="" disabled>請選擇原因</option>
            {ORDER_CANCELLATION_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          內部備註（選填；選「其他」時必填）
          <textarea name="note" maxLength={1000} rows={3} placeholder="例如：客戶來電要求取消，已確認尚未出貨。" className="rounded-md border bg-background px-3 py-2 font-normal leading-6" />
        </label>
        <div className="flex justify-end"><Button type="submit">新增取消紀錄</Button></div>
      </form>
    </section>
  );
}
