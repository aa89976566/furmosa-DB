import Link from 'next/link';
import { JarPanel, JarShell } from '@/components/jar-exchange/jar-shell';
import { PartnerStoresDirectory } from '@/components/jar-exchange/partner-stores-directory';
import { Button } from '@/components/ui/button';
import { listJarExchangeMerchants } from '@/lib/jar-exchange/partner-merchants';
import {
  mergePartnerStoreDirectory,
  partnerStoreDirectoryStats,
} from '@/lib/jar-exchange/partner-store-directory';
import { formatNumber } from '@/lib/format';
import { listPartnerStoresFromDb } from '@/lib/stores/partner-stores';
import { buildUnifiedStoreRedeemUrl } from '@/lib/stores/redeem-url';

export const dynamic = 'force-dynamic';

export default async function JarExchangeStoresPage() {
  const [stores, merchants] = await Promise.all([
    listPartnerStoresFromDb(),
    listJarExchangeMerchants(),
  ]);
  const rows = mergePartnerStoreDirectory({ stores, merchants });
  const stats = partnerStoreDirectoryStats(rows);

  return (
    <JarShell
      pathname="/jar-exchange/stores"
      title="合作店家"
      description="在同一份清單管理換罐夥伴、折價券核銷與店家結帳。"
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/store-report">核銷與結帳報表</Link>
          </Button>
          <Button size="sm" asChild>
            <a href={buildUnifiedStoreRedeemUrl()} target="_blank" rel="noreferrer">
              開啟統一核銷入口
            </a>
          </Button>
        </>
      }
    >
      <JarPanel>
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm text-navy">
            {formatNumber(stats.total)} 家合作店家
            <span className="text-muted-foreground">
              {' '}
              · {formatNumber(stats.redeemableCount)} 家可核銷 ·{' '}
              {formatNumber(stats.jarExchangeCount)} 家換罐後台
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            編號對不上會分開顯示。結帳只出現在可核銷店家。
          </p>
        </div>
        <PartnerStoresDirectory rows={rows} />
      </JarPanel>
    </JarShell>
  );
}
