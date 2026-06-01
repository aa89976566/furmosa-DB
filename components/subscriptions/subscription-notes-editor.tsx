'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { LinkifiedText } from '@/components/shared/linkified-text';
import { updateSubscriptionNotes } from '@/app/(main)/subscriptions/[id]/actions';
import { Check, Pencil, X } from 'lucide-react';

export function SubscriptionNotesEditor({
  subscriptionId,
  notes,
}: {
  subscriptionId: string;
  notes: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={async (fd) => {
          await updateSubscriptionNotes(fd);
          setEditing(false);
        }}
        className="space-y-2"
      >
        <input type="hidden" name="subscriptionId" value={subscriptionId} />
        <textarea
          name="notes"
          rows={4}
          autoFocus
          defaultValue={notes}
          placeholder="例：本盒內容物、出貨注意事項、客戶特殊要求…"
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
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
    <div className="flex items-start justify-between gap-2">
      {notes.trim() ? (
        <LinkifiedText
          text={notes}
          className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]"
        />
      ) : (
        <span className="flex-1 text-sm text-muted-foreground">尚無備註</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 text-muted-foreground"
        onClick={() => setEditing(true)}
      >
        <Pencil className="mr-1 h-3.5 w-3.5" />
        編輯
      </Button>
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Check className="mr-1 h-4 w-4" />
      {pending ? '儲存中…' : '儲存備註'}
    </Button>
  );
}
