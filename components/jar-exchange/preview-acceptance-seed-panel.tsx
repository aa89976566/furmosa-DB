'use client';

import { useState } from 'react';
import { createPreviewAcceptanceIdentityData } from '@/app/(main)/jar-exchange/stores/actions';
import { Button } from '@/components/ui/button';
import { VERDICT_LABEL } from '@/lib/jar-exchange/partner-store-identity-decisions';
import type { PREVIEW_ACCEPTANCE_ROWS } from '@/lib/jar-exchange/partner-store-identity-preview';

export function PreviewAcceptanceSeedPanel({
  rows,
  isolated,
  isolationReason,
}: {
  rows: typeof PREVIEW_ACCEPTANCE_ROWS;
  isolated: boolean;
  isolationReason: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="px-5 py-4">
      <p className="text-sm text-navy">建立驗收資料</p>
      <p className="mt-1 text-sm text-muted-foreground">
        開頁、登入、重新整理都不會寫入。只有按下面按鈕、且資料庫已隔離時才會新增。
      </p>
      {!isolated ? (
        <p className="mt-3 text-sm text-muted-foreground">
          目前未確認為獨立 Preview 資料庫
          {isolationReason ? `（${isolationReason}）` : ''}，按鈕已停用。
        </p>
      ) : null}
      <p className="mt-4 text-xs text-muted-foreground">將新增這 8 筆：</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
        {rows.map((row) => (
          <li key={`${row.merchantId}-${row.legacySlug ?? 'none'}`}>
            {row.legacySlug ?? '（無 slug）'} ↔ {row.merchantId} · {VERDICT_LABEL[row.verdict]}
          </li>
        ))}
      </ol>
      <form
        className="mt-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!isolated) return;
          setPending(true);
          setError(null);
          setResult(null);
          const response = await createPreviewAcceptanceIdentityData();
          setPending(false);
          if (!response.ok) {
            setError(response.error);
            return;
          }
          setResult(`已建立 ${response.inserted} 筆（已存在的不會重複）`);
        }}
      >
        <Button type="submit" size="sm" disabled={!isolated || pending}>
          {pending ? '建立中…' : '建立驗收資料'}
        </Button>
      </form>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {result ? <p className="mt-2 text-xs text-muted-foreground">{result}</p> : null}
    </div>
  );
}
