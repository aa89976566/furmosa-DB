import { getLiffId, isLiffConfigured } from '@/lib/line/liff-config';
import { LiffRewardsClient } from './rewards-client';

export const dynamic = 'force-dynamic';

export default function LiffRewardsPage() {
  if (!isLiffConfigured()) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-muted-foreground">
        LIFF 尚未設定（rewards）。請設定 LINE_LIFF_ID_REWARDS 後重新部署。
      </div>
    );
  }

  return <LiffRewardsClient liffId={getLiffId('rewards')} />;
}
