import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { PickupSearchPreview } from '@/components/logistics/pickup-search-preview';

export const dynamic = 'force-dynamic';

export default async function PickupPreviewPage() {
  // No public entry or production rollout; use the existing HQ session only.
  if (process.env.VERCEL_ENV !== 'preview') notFound();
  if (!(await getCurrentUser())) redirect('/login');
  return <>
    <PageHeader tone="logistics" title="門市搜尋驗收" description="7-ELEVEN 常溫門市 · HQ 內部預覽" />
    <div className="p-4 sm:p-6">
      <PickupSearchPreview enabled={process.env.PICKUP_SEARCH_PREVIEW_ENABLED === 'true'} />
    </div>
  </>;
}
