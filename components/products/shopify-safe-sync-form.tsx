'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { applySafeCatalogSyncAction, type CatalogSyncState } from '@/app/(main)/products/shopify-audit/actions';
import { Button } from '@/components/ui/button';

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending || count === 0}>{pending ? '同步中…' : count ? `同步 ${count} 筆安全項目` : '已是最新狀態'}</Button>;
}

export function ShopifySafeSyncForm({ fingerprint, count }: { fingerprint: string; count: number }) {
  const [state, action] = useFormState(applySafeCatalogSyncAction, { ok: false, message: '' } as CatalogSyncState);
  return <form action={action} className="space-y-2">
    <input type="hidden" name="fingerprint" value={fingerprint} />
    <SubmitButton count={count} />
    {state.message ? <p role="status" className={state.ok ? 'text-sm text-emerald-800' : 'text-sm text-red-700'}>{state.message}</p> : null}
  </form>;
}
