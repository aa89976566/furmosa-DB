import { getLiffId, isLiffConfigured } from '@/lib/line/liff-config';
import { LiffProfileClient } from './profile-client';

export const dynamic = 'force-dynamic';

export default function LiffProfilePage() {
  if (!isLiffConfigured()) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-muted-foreground">
        LIFF 尚未設定（profile）。請設定 LINE_LIFF_ID_PROFILE 後重新部署。
      </div>
    );
  }

  return <LiffProfileClient liffId={getLiffId('profile')} />;
}
