'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LinkifiedText } from '@/components/shared/linkified-text';
import { updateSubscriptionRecipient } from '@/app/(main)/subscriptions/[id]/actions';
import { Check, Pencil, X } from 'lucide-react';

export function SubscriptionRecipientEditor({
  subscriptionId,
  recipientName,
  recipientPhone,
  shippingAddress,
}: {
  subscriptionId: string;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <form
        action={async (fd) => {
          try {
            await updateSubscriptionRecipient(fd);
            setEditing(false);
            setError(null);
          } catch (e) {
            setError(e instanceof Error ? e.message : '儲存失敗');
          }
        }}
        className="space-y-3"
      >
        <input type="hidden" name="subscriptionId" value={subscriptionId} />
        <Field label="收件人">
          <Input name="recipientName" defaultValue={recipientName} maxLength={60} required />
        </Field>
        <Field label="收件電話">
          <Input name="recipientPhone" defaultValue={recipientPhone} maxLength={40} required />
        </Field>
        <Field label="收件地址">
          <textarea
            name="shippingAddress"
            rows={2}
            defaultValue={shippingAddress}
            required
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
            <X className="mr-1 h-4 w-4" />
            取消
          </Button>
          <SaveButton />
        </div>
      </form>
    );
  }

  return (
    <div>
      <dl className="min-w-0 space-y-2 text-sm">
        <Row label="收件人" value={recipientName || '—'} />
        <Row label="收件電話" value={recipientPhone || '—'} />
        <Row
          label="收件地址"
          value={
            shippingAddress ? (
              <LinkifiedText
                text={shippingAddress}
                className="block text-right break-words [overflow-wrap:anywhere]"
              />
            ) : (
              '—'
            )
          }
        />
      </dl>
      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setEditing(true)}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          編輯收件資料
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 pb-2 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 max-w-full flex-1 text-sm font-medium sm:text-right">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Check className="mr-1 h-4 w-4" />
      {pending ? '儲存中…' : '儲存收件資料'}
    </Button>
  );
}
