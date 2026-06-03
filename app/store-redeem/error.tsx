'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StoreRedeemError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-4">
      <h2 className="text-lg font-semibold text-navy">核銷頁暫時無法載入</h2>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{error.message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          再試一次
        </Button>
        <Button variant="outline" asChild>
          <Link href="/store-redeem">重新整理</Link>
        </Button>
      </div>
    </div>
  );
}
