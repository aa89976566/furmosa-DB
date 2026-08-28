import Link from 'next/link';
import { JarPanel, JarShell } from '@/components/jar-exchange/jar-shell';
import { PartnerStoresDirectory } from '@/components/jar-exchange/partner-stores-directory';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { listJarExchangeMerchants } from '@/lib/jar-exchange/partner-merchants';
import {
  mergePartnerStoreDirectory,
  partnerStoreDirectoryStats,
} from '@/lib/jar-exchange/partner-store-directory';
import { formatNumber } from '@/lib/format';
import { listPartnerStoresFromDb } from '@/lib/stores/partner-stores';
import { buildUnifiedStoreRedeemUrl } from '@/lib/stores/redeem-url';
import { ExternalLink, Receipt, Store, Ticket } from 'lucide-react';

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
            <Link href="/admin/store-report">
              <Receipt className="mr-1 h-3.5 w-3.5" />
              核銷與結帳報表
            </Link>
          </Button>
          <Button size="sm" asChild>
            <a href={buildUnifiedStoreRedeemUrl()} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              開啟統一核銷入口
            </a>
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            title="合作店家總數"
            value={formatNumber(stats.total)}
            description="核銷清單與換罐後台合併後的店家"
            icon={Store}
            accent="primary"
          />
          <StatCard
            title="可核銷店家數"
            value={formatNumber(stats.redeemableCount)}
            description="已開放折價券核銷"
            icon={Ticket}
            accent="success"
          />
          <StatCard
            title="換罐後台店家數"
            value={formatNumber(stats.jarExchangeCount)}
            description="寄賣後台標記為換罐"
            icon={Receipt}
            accent="info"
          />
        </div>

        <JarPanel>
          <div className="border-b border-border/60 px-5 py-4">
            <h2 className="text-base font-semibold text-navy">店家清單</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              同一家店只會出現一次。編號對不上的店會分開顯示，並標成「僅核銷清單」或「僅換罐後台」。
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              結帳只出現在可核銷店家，因為結帳報表是依核銷清單計算。
            </p>
          </div>
          <PartnerStoresDirectory rows={rows} />
        </JarPanel>
      </div>
    </JarShell>
  );
}
