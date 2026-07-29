import { Suspense } from 'react';
import { getLiffId, isLiffConfigured } from '@/lib/line/liff-config';
import { LiffRegisterClient } from './register-client';

export const dynamic = 'force-dynamic';

export default function LiffRegisterPage() {
  if (!isLiffConfigured()) {
    return <LiffSetupMissing page="register" />;
  }

  const liffId = getLiffId('register');
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
