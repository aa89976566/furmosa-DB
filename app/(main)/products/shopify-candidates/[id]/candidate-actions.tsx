'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CANDIDATE_BLOCK_REASONS } from '@/lib/shopify/catalog-candidate-resolution';
import {
  blockCandidateAction,
  linkCandidateAction,
  type CandidateActionState,
} from '../actions';

const initialState: CandidateActionState = { ok: false, message: '' };

function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-h-11">
      {pending ? pendingText : children}
    </Button>
  );
}

function ActionError({ state }: { state: CandidateActionState }) {
  return state.message ? (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {state.message}
    </p>
  ) : null;
}

export function LinkCandidateForm({
  candidateId,
  tierId,
  tierLabel,
}: {
  candidateId: string;
  tierId: string;
  tierLabel: string;
}) {
  const [state, action] = useActionState(linkCandidateAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="tierId" value={tierId} />
      <Input name="notes" maxLength={500} placeholder="備註（選填）" />
      <ActionError state={state} />
      <SubmitButton pendingText="連結中…">確認連結到「{tierLabel}」</SubmitButton>
    </form>
  );
}

export function BlockCandidateForm({ candidateId }: { candidateId: string }) {
  const [state, action] = useActionState(blockCandidateAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="candidateId" value={candidateId} />
      <label className="block space-y-1 text-sm font-medium">
        <span>不需建立的原因</span>
        <select
          name="reason"
          required
          defaultValue=""
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3"
        >
          <option value="" disabled>請選擇原因</option>
          {CANDIDATE_BLOCK_REASONS.map((reason) => (
            <option key={reason} value={reason}>{reason}</option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span>補充說明</span>
        <textarea
          name="note"
          maxLength={500}
          rows={3}
          placeholder="選擇「其他」時必填"
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>
      <p className="text-sm text-muted-foreground">
        完成後只會移出待處理清單，不會建立商品、修改庫存或回寫 Shopify。
      </p>
      <ActionError state={state} />
      <SubmitButton pendingText="處理中…">標記為不需建立</SubmitButton>
    </form>
  );
}
