'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  reviewProductWishAction,
  type ProductWishActionState,
} from './actions';

const initialState: ProductWishActionState = {};

export function ProductWishReviewForm({ wishId }: { wishId: string }) {
  const [state, action] = useFormState(reviewProductWishAction, initialState);

  return (
    <form action={action} className="space-y-4 rounded-2xl border bg-card p-5">
      <input type="hidden" name="wishId" value={wishId} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">HQ 備註</span>
        <textarea
          name="reviewNote"
          rows={4}
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          placeholder="例如：先記錄需求，月底依物種彙整找貨"
        />
      </label>
      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton decision="planned" label="列入找貨" />
        <SubmitButton decision="closed" label="暫時結案" variant="outline" />
      </div>
    </form>
  );
}

function SubmitButton({
  decision,
  label,
  variant = 'default',
}: {
  decision: 'planned' | 'closed';
  label: string;
  variant?: 'default' | 'outline';
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="decision"
      value={decision}
      variant={variant}
      disabled={pending}
      className="min-h-11 flex-1"
    >
      {pending ? '處理中…' : label}
    </Button>
  );
}
