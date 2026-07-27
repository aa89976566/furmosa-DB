'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function PosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[pos]', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-8">
      <h1 className="text-lg font-semibold text-navy">店家頁面載入失敗</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        伺服器渲染時發生錯誤。請再試一次；若持續出現，把下方錯誤代碼告訴工程師。
        {error.digest ? (
          <>
            <br />
            <span className="font-mono text-xs">digest: {error.digest}</span>
          </>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          再試一次
        </Button>
        <Button variant="outline" asChild>
          <Link href="/pos">返回今天</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/pos/login">重新登入</Link>
        </Button>
      </div>
    </div>
  );
}
