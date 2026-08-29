import Link from 'next/link';
import { JarPanel, JarShell } from '@/components/jar-exchange/jar-shell';
import { PartnerStoreIdentityHistory } from '@/components/jar-exchange/partner-store-identity-history';
import { PartnerStoresDirectory } from '@/components/jar-exchange/partner-stores-directory';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth';
import { formatNumber } from '@/lib/format';
import { listJarExchangeMerchants } from '@/lib/jar-exchange/partner-merchants';
import {
  mergePartnerStoreDirectory,
  partnerStoreDirectoryStats,
} from '@/lib/jar-exchange/partner-store-directory';
import { isPreviewIdentityEnv } from '@/lib/jar-exchange/partner-store-identity-decisions';
import {
  ensurePreviewIdentityTable,
  seedPreviewIdentityDecisions,
} from '@/lib/jar-exchange/partner-store-identity-preview';
import { listIdentityDecisions } from '@/lib/jar-exchange/partner-store-identity-store';
import { listPartnerStoresFromDb } from '@/lib/stores/partner-stores';
import { buildUnifiedStoreRedeemUrl } from '@/lib/stores/redeem-url';

export const dynamic = 'force-dynamic';

export default async function JarExchangeStoresPage() {
  const user = await getCurrentUser();
  if (isPreviewIdentityEnv() && user) {
    await ensurePreviewIdentityTable();
    await seedPreviewIdentityDecisions({ userId: user.userId, email: user.email });
  }

  const [stores, merchants, records] = await Promise.all([
    listPartnerStoresFromDb(),
    listJarExchangeMerchants(),
    listIdentityDecisions(),
  ]);
  const rows = mergePartnerStoreDirectory({ stores, merchants }, records);
  const stats = partnerStoreDirectoryStats(rows, {
    storeSlugs: stores.map((store) => store.slug),
    merchantIds: merchants.map((merchant) => merchant.merchantId),
    decisions: records,
  });

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
              · {formatNumber(stats.officialOneToOneCount)} 家已確認一對一 ·{' '}
              {formatNumber(stats.needsReviewCount)} 家待確認 ·{' '}
              {formatNumber(stats.redeemableCount)} 家可核銷
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            清單只讀有效的人工確認。編號對不上會分開顯示。結帳只出現在可核銷店家。
          </p>
        </div>
        <PartnerStoresDirectory rows={rows} />
      </JarPanel>
      <div className="mt-6">
        <JarPanel>
          <PartnerStoreIdentityHistory
            records={records}
            merchantIds={merchants.map((merchant) => merchant.merchantId)}
          />
        </JarPanel>
      </div>
    </JarShell>
  );
}
