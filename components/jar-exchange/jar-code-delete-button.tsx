'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteJarCode } from '@/app/(main)/jar-exchange/actions';

export function JarCodeDeleteButton({
  id,
  code,
  used,
}: {
  id: string;
  code: string;
  used?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => {
          const warn = used
            ? `序號「${code}」已返航。刪除後會撤銷其帶來的點數，並可重新使用此序號。確定刪除？`
            : `確定要刪除序號「${code}」嗎？此動作無法復原。`;
          if (!confirm(warn)) return;
          setError(null);
          const fd = new FormData();
          fd.set('id', id);
          startTransition(async () => {
            const res = await deleteJarCode(fd);
            if (!res.ok) setError(res.error);
          });
        }}
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        刪除
      </Button>
      {error ? <span className="text-[10px] text-destructive">{error}</span> : null}
    </div>
  );
}
