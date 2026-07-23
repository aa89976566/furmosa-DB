'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function NewOrderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[orders/new]', error);
  }, [error]);

  const isDb =
    error.message.includes("Can't reach database") ||
    error.message.includes('P1001') ||
    error.message.includes('P1017');

  return (
    <div className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-lg font-semibold text-navy">
        {isDb ? '暫時無法連線資料庫' : '載入新增訂單失敗'}
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {isDb ? (
          <>
            無法連到 Supabase（連線池 6543）。請確認網路正常、Supabase 專案未暫停，並檢查{' '}
            <code className="rounded bg-muted px-1 text-xs">.env</code> 的{' '}
            <code className="rounded bg-muted px-1 text-xs">DATABASE_URL</code>。
            本機開發建議使用{' '}
            <code className="rounded bg-muted px-1 text-xs">
              pgbouncer=true&amp;connection_limit=5&amp;pool_timeout=20
            </code>
            （勿用 connection_limit=1，並行查詢會卡住約 10 秒）。
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
