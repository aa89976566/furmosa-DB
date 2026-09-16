'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { orderArchiveAction } from '@/app/(main)/orders/archive-actions';
import { Button } from '@/components/ui/button';

function Submit({ archived }: { archived: boolean }) {
  const { pending } = useFormStatus();
  return <Button variant="outline" size="sm" disabled={pending}>{pending ? '處理中…' : archived ? '恢復訂單' : '移至歷史訂單'}</Button>;
}

export function OrderArchiveForm({ orderId, archived }: { orderId: string; archived: boolean }) {
  const [state, action] = useFormState(orderArchiveAction, { message: '' });
  return <form action={action} className="space-y-2 rounded-xl border bg-card p-4">
    <input type="hidden" name="orderId" value={orderId} />
    <input type="hidden" name="action" value={archived ? 'restore' : 'archive'} />
    <p className="text-sm font-semibold">{archived ? '歷史訂單' : '封存訂單'}</p>
    <p className="text-xs text-muted-foreground">{archived ? '恢復後會重新出現在待審核。' : '保留原始資料，只從待審核與工作清單移除。'}</p>
    <Submit archived={archived} />
    {state.message ? <p role="status" className="text-xs">{state.message}</p> : null}
  </form>;
}
