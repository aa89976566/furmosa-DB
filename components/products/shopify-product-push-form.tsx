'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { pushProductToShopifyAction, type ProductPushState } from '@/app/(main)/products/[id]/shopify-push-actions';

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={disabled || pending}>{pending ? '同步中…' : '同步售價、成本與重量'}</Button>;
}
export function ShopifyProductPushForm({ productId, fingerprint, disabled, reason }: {
  productId: string; fingerprint: string; disabled: boolean; reason?: string;
}) {
  const [state, action] = useFormState(pushProductToShopifyAction, { ok: false, message: '' } as ProductPushState);
  return <form action={action} className="space-y-3">
    <p className="text-sm text-muted-foreground">同步已儲存的單品規格至原有 Shopify 商品。請先儲存上方修改。</p>
    <input type="hidden" name="productId" value={productId} />
    <input type="hidden" name="fingerprint" value={fingerprint} />
    <Submit disabled={disabled} />
    {reason ? <p className="text-sm text-muted-foreground">{reason}</p> : null}
    <p className="text-sm text-muted-foreground">圖片、介紹、營養資訊、發布狀態與庫存不在本次同步範圍。</p>
    {state.message ? <p role="status" className={state.ok ? 'text-sm text-emerald-800' : 'text-sm text-red-700'}>{state.message}</p> : null}
  </form>;
}
