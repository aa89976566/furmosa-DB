import { getLiffId, isLiffConfigured } from '@/lib/line/liff-config';
import { LiffProfileClient } from './profile-client';

export const dynamic = 'force-dynamic';

export default async function LiffProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; bindToken?: string }>;
}) {
  if (!isLiffConfigured()) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-muted-foreground">
        LIFF 尚未設定（profile）。請設定 LINE_LIFF_ID_PROFILE 後重新部署。
      </div>
    );
  }

  const params = await searchParams;
  return (
    <LiffProfileClient
      liffId={getLiffId('profile')}
      mode={params.mode === 'merchant-bind' ? 'merchant-bind' : 'profile'}
      bindToken={params.bindToken}
    />
  );
}
