'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[main]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-lg font-semibold text-navy">頁面載入失敗</h1>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {error.message}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          再試一次
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">返回 Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
