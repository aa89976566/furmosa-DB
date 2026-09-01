'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { orderDeletionAction } from '@/app/(main)/orders/delete-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
function Submit({ deleted }: { deleted: boolean }) {
  const { pending } = useFormStatus();
  return <Button variant={deleted ? 'outline' : 'destructive'} disabled={pending}>{pending ? '處理中…' : deleted ? '確認還原' : '確認刪除（僅 HQ）'}</Button>;
}
export function OrderDeletionForm({ orderId, orderNumber, deleted }: { orderId: string; orderNumber: string; deleted: boolean }) {
  const [state, action] = useFormState(orderDeletionAction, { message: '' });
  return <details className="rounded-lg border bg-background p-3"><summary className="cursor-pointer text-sm font-medium">{deleted ? '還原訂單' : '更多操作'}</summary>
    <form action={action} className="mt-3 space-y-3">
      <p className="text-sm font-medium">{deleted ? '將訂單放回處理清單' : '從 HQ 處理清單移除'}</p>
      <p className="text-xs text-muted-foreground">不會刪除 Shopify 原始訂單，資料仍可還原。已有付款或出貨紀錄時系統會阻擋。</p>
      <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="action" value={deleted ? 'restore' : 'delete'} />
      <label className="block text-sm">請輸入完整訂單編號：{orderNumber}<Input name="confirmNumber" required autoComplete="off" /></label>
      <Submit deleted={deleted} />{state.message && <p role="status">{state.message}</p>}
    </form>
  </details>;
}
