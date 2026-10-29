'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { CANDIDATE_BLOCK_REASONS } from '@/lib/shopify/catalog-candidate-shared';
import {
  blockCandidateAction,
  linkCandidateAction,
  type CandidateActionState,
} from '../actions';

const initialState: CandidateActionState = { ok: false, message: '' };

function SubmitButton({ children, pendingText, variant = 'default' }: {
  children: React.ReactNode;
  pendingText: string;
  variant?: 'default' | 'outline';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} className="min-h-11">
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

export function LinkCandidateForm(props: {
  candidateId: string;
  tierId: string;
  fingerprint: string;
  tierLabel: string;
}) {
  const [state, action] = useActionState(linkCandidateAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="candidateId" value={props.candidateId} />
      <input type="hidden" name="tierId" value={props.tierId} />
      <input type="hidden" name="expectedFingerprint" value={props.fingerprint} />
      <ActionError state={state} />
      <SubmitButton pendingText="確認中…">確認連結「{props.tierLabel}」</SubmitButton>
    </form>
  );
}

export function BlockCandidateForm(props: { candidateId: string; fingerprint: string }) {
  const [state, action] = useActionState(blockCandidateAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="candidateId" value={props.candidateId} />
      <input type="hidden" name="expectedFingerprint" value={props.fingerprint} />
      <label className="block space-y-1 text-sm font-medium">
        <span>這次不建立的原因</span>
        <select name="reason" required defaultValue="" className="min-h-11 w-full rounded-lg border border-border bg-background px-3">
          <option value="" disabled>請選擇原因</option>
          {CANDIDATE_BLOCK_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span>補充說明</span>
        <textarea
          name="note"
          maxLength={500}
          rows={2}
          placeholder="選擇「其他」時必填"
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        不會刪除 Shopify 商品；未對應訂單仍會保持阻擋，不會自動出貨或扣庫存。
      </p>
      <ActionError state={state} />
      <SubmitButton pendingText="處理中…" variant="outline">確認這次不建立</SubmitButton>
    </form>
  );
}
