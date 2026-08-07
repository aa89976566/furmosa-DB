import { Suspense } from 'react';
import { getLiffIdIfConfigured } from '@/lib/line/liff-config';
import { LiffRegisterClient } from './register-client';

export const dynamic = 'force-dynamic';

export default function LiffRegisterPage({
  searchParams,
}: {
  searchParams?: { return?: string };
}) {
  const returnPath = searchParams?.return ?? '';
  // Inside the refill LIFF webview, re-init with a different LIFF ID fails
  // (browser "Failed to fetch"). Keep the refill LIFF app for that return path.
  const fromRefill = returnPath.startsWith('/liff/refill');
  const liffId = fromRefill
    ? (getLiffIdIfConfigured('refill') ?? getLiffIdIfConfigured('register'))
    : getLiffIdIfConfigured('register');

  if (!liffId) {
    return <LiffSetupMissing page="register" />;
  }

  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">載入中…</p>}>
      <LiffRegisterClient liffId={liffId} />
    </Suspense>
  );
}

function LiffSetupMissing({ page }: { page: string }) {
  return (
    <div className="mx-auto max-w-md p-6 text-sm text-muted-foreground">
      LIFF 尚未設定（{page}）。請在 Vercel 設定 LINE_LIFF_ID 或 LINE_LIFF_ID_REGISTER 後重新部署。
    </div>
  );
}
