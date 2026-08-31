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
  return <details className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">{deleted ? '還原訂單' : '刪除訂單'}</summary>
    <form action={action} className="mt-3 space-y-3">
      <p className="text-sm">僅從 HQ 隱藏，保留紀錄供還原，不刪 Shopify 原始訂單。已有付款／出貨紀錄會阻擋；還原後必須重新審核。</p>
      <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="action" value={deleted ? 'restore' : 'delete'} />
      <label className="block text-sm">請輸入完整訂單編號：{orderNumber}<Input name="confirmNumber" required autoComplete="off" /></label>
      <Submit deleted={deleted} />{state.message && <p role="status">{state.message}</p>}
    </form>
  </details>;
}
