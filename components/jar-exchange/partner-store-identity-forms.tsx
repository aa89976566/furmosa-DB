'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  savePartnerStoreIdentityDecision,
  revokePartnerStoreIdentityDecision,
} from '@/app/(main)/jar-exchange/stores/actions';

const fieldClass =
  'flex h-10 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function RevokeIdentityDecisionForm({
  decisionId,
  storeName,
}: {
  decisionId: string;
  storeName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setPending(true);
        setError(null);
        const result = await revokePartnerStoreIdentityDecision(new FormData(form));
        setPending(false);
        if (!result.ok) setError(result.error);
      }}
    >
      <input type="hidden" name="decisionId" value={decisionId} />
      <label className="min-w-0 flex-1 text-xs text-muted-foreground">
        撤銷 {storeName}
        <Input
          name="revokeReason"
          required
          className="mt-1"
          placeholder="撤銷原因"
        />
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? '撤銷中…' : '撤銷確認'}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}

export function AddIdentityDecisionForm({ merchantIds }: { merchantIds: string[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setPending(true);
        setError(null);
        const result = await savePartnerStoreIdentityDecision(new FormData(form));
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        form.reset();
      }}
    >
      <label className="text-xs text-muted-foreground">
        舊核銷 slug
        <Input name="legacySlug" className="mt-1" placeholder="例如 pet99（示範可留空）" />
      </label>
      <label className="text-xs text-muted-foreground">
        唯一 MER 編號
        <select name="merchantId" required className={`${fieldClass} mt-1`} defaultValue="">
          <option value="" disabled>
            選擇既有 MER
          </option>
          {merchantIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        判定
        <select name="verdict" required className={`${fieldClass} mt-1`} defaultValue="same_store">
          <option value="same_store">同一門市</option>
          <option value="test">測試</option>
          <option value="demo">示範</option>
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        另一筆如何處理
        <select
          name="otherRecordDisposition"
          required
          className={`${fieldClass} mt-1`}
          defaultValue="keep_legacy_link"
        >
          <option value="keep_legacy_link">保留舊核銷連結</option>
          <option value="merge_into_kept">併入保留編號</option>
          <option value="mark_as_branch">標為分店</option>
          <option value="retire_and_keep_number">停用但保留編號</option>
        </select>
      </label>
      <label className="text-xs text-muted-foreground md:col-span-2">
        確認依據
        <Input name="rationale" required className="mt-1" placeholder="為什麼是同一家或測試／示範" />
      </label>
      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? '保存中…' : '保存人工確認'}
        </Button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </form>
  );
}
