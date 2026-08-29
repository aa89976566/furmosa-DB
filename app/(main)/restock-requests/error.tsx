'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function RestockRequestsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[restock-requests]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-lg font-semibold text-navy">補貨申請暫時讀取失敗</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        現在看不到店家送出的補貨申請。請重新載入後再試。
      </p>
      <Button type="button" onClick={() => reset()}>
        重新載入
      </Button>
    </div>
  );
}
