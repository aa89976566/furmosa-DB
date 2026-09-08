'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { reconcilePromotionCaptureAction, type PromotionResyncState } from '@/app/(main)/orders/reconcile-actions';
import { Button } from '@/components/ui/button';

const initialState: PromotionResyncState = { ok: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" variant="outline" disabled={pending}>
    {pending ? '重新同步中…' : '重新同步 Shopify 活動資料'}
  </Button>;
}

export function OmsPromotionResync({ orderId }: { orderId: string }) {
  const [state, action] = useFormState(reconcilePromotionCaptureAction, initialState);
  return <form action={action} className="space-y-2 rounded-md border border-warning/30 bg-background/70 p-3">
    <input type="hidden" name="orderId" value={orderId} />
    <p className="text-xs text-muted-foreground">
      此舊單缺少滿額贈辨識欄位。只重新讀取這一張 Shopify 訂單，不會建立出貨或批次同步其他訂單。
    </p>
    <SubmitButton />
    {state.message ? <p role="status" className={`text-xs ${state.ok ? 'text-muted-foreground' : 'text-warning'}`}>{state.message}</p> : null}
  </form>;
}
