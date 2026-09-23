'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** 登入頁專用：勿沿用「店家頁面載入失敗」（那是已登入區的文案） */
export default function PosLoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[pos/login]', error);
  }, [error]);

  function reloadLogin() {
    // Error boundaries retain their failed client state when navigating to the
    // same route with <Link>. Use a document navigation so a merchant can
    // actually restart the login flow after a transient server-action error.
    window.location.assign('/pos/login');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-8">
      <h1 className="text-lg font-semibold text-navy">店家登入失敗</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        登入處理時發生錯誤。請再試一次；若持續出現，把下方錯誤代碼告訴工程師。
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
        <Button type="button" variant="outline" onClick={reloadLogin}>
          重新載入登入頁
        </Button>
      </div>
    </div>
  );
}
