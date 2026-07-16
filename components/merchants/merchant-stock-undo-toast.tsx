'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { undoMerchantStockMovement } from '@/app/(main)/merchants/[id]/actions';

export type StockUndoToast = {
  txnId: string;
  tierId: string;
  summary: string;
};

export function MerchantStockUndoToast({
  toast,
  onDismiss,
}: {
  toast: StockUndoToast | null;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState(5);

  useEffect(() => {
    if (!toast) return;
    setLeft(5);
    const tick = setInterval(() => setLeft((s) => s - 1), 1000);
    const done = setTimeout(() => onDismiss(), 5000);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg border bg-foreground px-4 py-3 text-background shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-snug">{toast.summary}</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          className="shrink-0"
          onClick={() => {
            const fd = new FormData();
            fd.set('txnId', toast.txnId);
            fd.set('tierId', toast.tierId);
            startTransition(async () => {
              await undoMerchantStockMovement(fd);
              onDismiss();
              router.refresh();
            });
          }}
        >
          撤銷{left > 0 ? ` ${left}s` : ''}
        </Button>
      </div>
    </div>
  );
}
