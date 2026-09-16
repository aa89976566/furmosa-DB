'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { archiveOlderPendingOrders } from '@/app/(main)/orders/archive-actions';
import { Button } from '@/components/ui/button';

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="outline" size="sm" disabled={pending}>{pending ? '封存中…' : '封存本週以前訂單'}</Button>;
}

export function ArchiveOlderOrdersForm() {
  const [state, action] = useFormState(archiveOlderPendingOrders, { message: '' });
  return <form action={action} className="flex flex-wrap items-center gap-2" onSubmit={(event) => {
    if (!window.confirm('確定將本週一以前、仍待審核的訂單移至歷史訂單？')) event.preventDefault();
  }}>
    <input type="hidden" name="confirm" value="archive-before-week" />
    <Submit />
    <span className="text-xs text-muted-foreground">僅處理本週一以前、仍待審核的訂單</span>
    {state.message ? <span role="status" className="w-full text-xs">{state.message}</span> : null}
  </form>;
}
