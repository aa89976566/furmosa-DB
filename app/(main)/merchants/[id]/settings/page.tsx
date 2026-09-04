import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { MerchantTypeBadges } from '@/components/merchants/merchant-type-badges';
import { MerchantShippingPanel } from '@/components/merchants/merchant-shipping-panel';
import { MerchantDlRow, MerchantSection, MerchantWorkspace } from '@/components/merchants/merchant-ui';
import { getMerchantIndustry } from '@/lib/merchant-industry-persist';
import { getMerchantTypes } from '@/lib/merchant-types-persist';
import { merchantCarrierLabel } from '@/lib/merchant-shipping-defaults';
import { merchantIndustryDisplay } from '@/lib/labels';
import { ArrowRight, PackageSearch } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MerchantSettingsPage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({ where: { id: params.id } });
  if (!merchant) notFound();

  const [industry, types] = await Promise.all([
    getMerchantIndustry(prisma, merchant.id),
    getMerchantTypes(prisma, merchant.id, merchant.type),
  ]);

  return (
    <MerchantWorkspace>
      <div className="grid gap-4 lg:grid-cols-2">
        <MerchantSection title="店家資料" description="辨識店家與日常聯絡所需的基本資料">
          <dl>
            <MerchantDlRow label="店家編號" value={<span className="font-mono text-xs">{merchant.merchantId}</span>} />
            <MerchantDlRow label="合作項目" value={<MerchantTypeBadges types={types} />} />
            <MerchantDlRow label="產業" value={merchantIndustryDisplay(industry)} />
            <MerchantDlRow label="聯絡人" value={merchant.contactName ?? '—'} />
            <MerchantDlRow label="電話" value={merchant.phone ?? '—'} />
            <MerchantDlRow label="Email" value={merchant.email ?? '—'} />
            <MerchantDlRow label="城市" value={merchant.city ?? '—'} />
          </dl>
        </MerchantSection>

        <MerchantSection title="配送設定" description="建立店家補貨出貨單時自動帶入">
          <dl>
            <MerchantDlRow label="預設物流" value={merchantCarrierLabel(merchant.preferredCarrier)} />
            <MerchantDlRow label="收貨地址／門市" value={merchant.pickupStoreName ?? merchant.address ?? '—'} />
          </dl>
          <MerchantShippingPanel
            merchant={{
              id: merchant.id,
              types,
              industry,
              contactName: merchant.contactName,
              phone: merchant.phone,
              email: merchant.email,
              city: merchant.city,
              address: merchant.address,
              preferredCarrier: merchant.preferredCarrier,
              pickupStoreName: merchant.pickupStoreName,
            }}
          />
        </MerchantSection>
      </div>

      <MerchantSection title="商務條件" description="商品資格、分潤與店家專屬進貨價的唯一設定入口">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/merchants/${merchant.id}/rule`}>
              管理商品與分潤
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          {types.includes('wholesale') ? (
            <Button variant="outline" asChild>
              <Link href={`/merchants/${merchant.id}/wholesale-prices`}>
                <PackageSearch className="mr-2 h-4 w-4" />
                管理店家進貨價
              </Link>
            </Button>
          ) : null}
        </div>
      </MerchantSection>
    </MerchantWorkspace>
  );
}
