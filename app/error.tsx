'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app]', error);
  }, [error]);

  const isPrismaStale = error.message.includes('Prisma Client 過期');
  const isDb =
    error.message.includes("Can't reach database") ||
    error.message.includes('P1001') ||
    error.message.includes('P1017');

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-8">
      <h1 className="text-lg font-semibold text-navy">
        {isPrismaStale ? 'Prisma Client 需更新' : isDb ? '無法連線資料庫' : '發生錯誤'}
      </h1>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {isPrismaStale ? (
          <>
            請關閉所有 <code className="rounded bg-muted px-1 text-xs">npm run dev</code>（含
            3000/3001/3002），再執行：
            <br />
            <code className="mt-2 block rounded bg-muted p-2 text-xs">
              npx prisma migrate deploy && npx prisma generate && rm -rf .next && npm run dev
            </code>
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
