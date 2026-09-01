import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { CustomerJarExchangePanel } from '@/components/customers/customer-jar-exchange-panel';
import { loadCustomerDetail } from '@/lib/customers/load-customer-detail';

export const dynamic = 'force-dynamic';

export default async function CustomerJarExchangeActionsPage({ params }: { params: { id: string } }) {
  const data = await loadCustomerDetail(params.id);
  if (!data?.hasJar || !data.jar) notFound();

  return (
    <>
      <PageHeader
        tone="supply"
        title="換罐操作"
        description={`${data.customer.name} · ${data.customer.customerId}`}
        actions={<Button variant="outline" size="sm" asChild><Link href={`/customers/${data.customer.id}`}><ArrowLeft className="mr-1 h-4 w-4" />返回會員</Link></Button>}
      />
      <main className="mx-auto max-w-4xl p-6 pb-12">
        <SectionCard title="換罐會員" description="兌換獎勵、序號核銷與帳本入口" tone="supply" contentClassName="pt-6">
          <CustomerJarExchangePanel
            customerId={data.customer.id}
            customerName={data.customer.name}
            pointsBalance={data.jar.stats.pointsBalance}
            codesRedeemed={data.jar.stats.codesRedeemed}
            rewardsRedeemed={data.jar.stats.rewardsRedeemed}
            jarServiceStatus={data.jar.stats.jarServiceStatus}
            lastActivityAt={data.jar.stats.lastActivityAt}
            ledgerCount={data.jar.ledgerCount}
            redemptionCount={data.jar.redemptionCount}
            jarCodesCount={data.jar.jarCodesCount}
            redemptions={data.jar.redemptions.map((redemption) => ({
              redemptionCode: redemption.redemptionCode,
              rewardName: redemption.reward.rewardName,
              pointsSpent: redemption.pointsSpent,
              couponCode: redemption.couponCode,
              couponFaceValue: redemption.reward.couponFaceValue,
              issuedAt: redemption.issuedAt,
              couponStatus: redemption.couponStatus,
            }))}
            rewardOptions={data.jar.rewardOptions}
          />
        </SectionCard>
      </main>
    </>
  );
}
