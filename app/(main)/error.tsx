'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { isPrismaConnectionError } from '@/lib/prisma-connection-error';

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

  const isDb = isPrismaConnectionError(error);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-lg font-semibold text-navy">
        {isDb ? '無法連線資料庫' : '頁面載入失敗'}
      </h1>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {isDb ? (
          <>
            暫時無法連上 Supabase 資料庫（連線池可能忙碌或專案剛從休眠喚醒）。
            <br />
            請按「再試一次」；若持續失敗，到 Supabase Dashboard 確認專案是否已暫停，或稍等 30
            秒後重新整理。
          </>
        ) : (
          error.message
        )}
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
