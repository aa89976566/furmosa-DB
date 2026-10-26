'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { stageUnmatchedCatalogAction, type CatalogSyncState } from '@/app/(main)/products/shopify-audit/actions';
import { Button } from '@/components/ui/button';

const initialState: CatalogSyncState = { ok: false, message: '' };

export function ShopifyStageCandidatesForm({ fingerprint, count }: { fingerprint: string; count: number }) {
  const [state, action, pending] = useActionState(stageUnmatchedCatalogAction, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="fingerprint" value={fingerprint} />
      <Button type="submit" variant="outline" disabled={pending || count === 0}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        登記全部待建商品
      </Button>
      {state.message ? <p className={`max-w-sm text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>{state.message}</p> : null}
    </form>
  );
}
