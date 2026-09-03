'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { orderDeletionAction } from '@/app/(main)/orders/delete-actions';
import { Button } from '@/components/ui/button';
import { orderDeletionReasons } from '@/lib/orders/delete-policy';
function Submit({ deleted }: { deleted: boolean }) {
  const { pending } = useFormStatus();
  return <Button variant={deleted ? 'outline' : 'destructive'} disabled={pending}>{pending ? '處理中…' : deleted ? '確認還原' : '刪除訂單'}</Button>;
}
export function OrderDeletionForm({ orderId, deleted }: { orderId: string; orderNumber: string; deleted: boolean }) {
  const [state, action] = useFormState(orderDeletionAction, { message: '' });
  return <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer text-sm font-semibold">{deleted ? '還原訂單' : '刪除訂單'}</summary>
    <form action={action} className="mt-3 space-y-3">
      <p className="text-xs text-muted-foreground">刪除後不會進入審核或出貨流程，管理員仍可從已刪除清單還原。</p>
      <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="action" value={deleted ? 'restore' : 'delete'} />
      {!deleted ? <label className="block space-y-1.5 text-sm font-medium">刪除原因
        <select name="reason" required defaultValue="" className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="" disabled>請選擇原因</option>
          {orderDeletionReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
        </select>
      </label> : null}
      <Submit deleted={deleted} />{state.message && <p role="status">{state.message}</p>}
    </form>
  </details>;
}
