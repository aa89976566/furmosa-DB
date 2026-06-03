import { StoreRedeemPageContent } from '@/components/coupons/store-redeem-page-content';
import { listRedeemStores } from '@/lib/stores/list-redeem-stores';
import { verifyStoreAccessSegment } from '@/lib/stores/verify-store-access';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = { params: { access: string } };

export default async function StoreAccessRedeemPage({ params }: Props) {
  const verified = await verifyStoreAccessSegment(params.access);
  const stores = await listRedeemStores();

  if (!verified) {
    return (
      <div className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <h2 className="text-lg font-semibold text-navy">無效的店家連結</h2>
        <p className="text-sm text-muted-foreground">
          請確認網址是否完整，或使用匠寵提供的最新核銷連結。
        </p>
        <Button asChild>
          <Link href="/store-redeem">前往統一核銷入口</Link>
        </Button>
      </div>
    );
  }

  return (
    <StoreRedeemPageContent
      stores={stores}
      defaultStoreSlug={verified.slug}
      storeLabel={verified.name}
      lockedStore
    />
  );
}
