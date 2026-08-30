import Link from 'next/link';
import { JarPanel, JarShell } from '@/components/jar-exchange/jar-shell';
import { PartnerStoreIdentityHistory } from '@/components/jar-exchange/partner-store-identity-history';
import { PartnerStoresDirectory } from '@/components/jar-exchange/partner-stores-directory';
import { PreviewModeBanner } from '@/components/jar-exchange/preview-mode-banner';
import { PreviewReadonlyNotice } from '@/components/jar-exchange/preview-readonly-notice';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { listJarExchangeMerchants } from '@/lib/jar-exchange/partner-merchants';
import {
  mergePartnerStoreDirectory,
  partnerStoreDirectoryStats,
} from '@/lib/jar-exchange/partner-store-directory';
import { isPreviewIdentityEnv } from '@/lib/jar-exchange/partner-store-identity-decisions';
import { withPreviewReadOnlyOverlay } from '@/lib/jar-exchange/partner-store-identity-preview-overlay';
import { listIdentityDecisions } from '@/lib/jar-exchange/partner-store-identity-store';
import { listPartnerStoresFromDb } from '@/lib/stores/partner-stores';
import { buildUnifiedStoreRedeemUrl } from '@/lib/stores/redeem-url';

export const dynamic = 'force-dynamic';

export default async function JarExchangeStoresPage() {
  const preview = isPreviewIdentityEnv();
  const [stores, merchants, officialRecords] = await Promise.all([
    listPartnerStoresFromDb(),
    listJarExchangeMerchants(),
    listIdentityDecisions('production'),
  ]);
  const directoryRecords = preview
    ? withPreviewReadOnlyOverlay(officialRecords)
    : officialRecords;
  const rows = mergePartnerStoreDirectory({ stores, merchants }, directoryRecords);
  const stats = partnerStoreDirectoryStats(rows, {
    storeSlugs: stores.map((store) => store.slug),
    merchantIds: merchants.map((merchant) => merchant.merchantId),
    decisions: directoryRecords,
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
      {preview ? <PreviewModeBanner /> : null}
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
            {preview
              ? '預覽清單依總部已鎖定對照顯示五家確認店；測試店不進正式清單。這些對照不會寫入資料庫。'
              : '清單只讀有效的人工確認。編號對不上會分開顯示。結帳只出現在可核銷店家。'}
          </p>
        </div>
        <PartnerStoresDirectory rows={rows} writesDisabled={preview} />
      </JarPanel>
      {preview ? (
        <div className="mt-6">
          <JarPanel>
            <PreviewReadonlyNotice />
          </JarPanel>
        </div>
      ) : null}
      <div className="mt-6">
        <JarPanel>
          <PartnerStoreIdentityHistory records={officialRecords} />
        </JarPanel>
      </div>
    </JarShell>
  );
}
