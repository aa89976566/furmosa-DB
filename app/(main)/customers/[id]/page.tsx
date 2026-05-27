import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { SummaryTile } from '@/components/customers/customer-detail-ui';
import { CustomerContactCard } from '@/components/customers/customer-contact-card';
import { CustomerServicesBlock } from '@/components/customers/customer-services-block';
import { CustomerJarExchangePanel } from '@/components/customers/customer-jar-exchange-panel';
import { CustomerOrdersPreview } from '@/components/customers/customer-orders-preview';
import { loadCustomerDetail } from '@/lib/customers/load-customer-detail';
import { parseTags } from '@/lib/parse-tags';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { customerServiceTypeLabel } from '@/lib/jar-exchange/labels';
import { ArrowLeft, Repeat } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const data = await loadCustomerDetail(params.id);
  if (!data) notFound();

  const { customer, hasJar, jar } = data;
  const tags = parseTags(customer.tags);
  const activeSub = customer.subscriptions.find((s) => s.status === 'active');
  const orderTotal = customer._count.orders;

  return (
    <>
      <PageHeader
        tone="master"
        title={customer.name}
        description={
          <span className="font-mono text-xs tracking-wide text-foreground/70">
            {customer.customerId}
          </span>
        }
        actions={
          <div className="flex gap-2">
            {customer.phone ? (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${customer.phone}`}>撥打</a>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href="/customers">
                <ArrowLeft className="mr-1 h-4 w-4" />
                返回
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-5xl space-y-6 p-6 pb-10">
        <div className="flex flex-wrap gap-2">
          {customer.services
            .filter((s) => s.serviceStatus === 'active')
            .map((s) => (
              <Badge key={s.serviceType} variant="secondary">
                {customerServiceTypeLabel[s.serviceType] ?? s.serviceType}
              </Badge>
            ))}
          {activeSub ? (
            <Badge variant="info" className="gap-1">
              <Repeat className="h-3 w-3" />
              {activeSub.plan.name}
            </Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile
            label="累計消費"
            value={formatCurrency(Number(customer.totalSpent))}
            sub={customer.lastOrderAt ? `最近 ${formatDate(customer.lastOrderAt)}` : '尚無訂單'}
          />
          <SummaryTile label="訂單" value={formatNumber(orderTotal)} sub="筆" />
          {hasJar && jar ? (
            <SummaryTile
              label="換罐點數"
              value={formatNumber(jar.stats.pointsBalance)}
              sub={`已兌 ${jar.stats.rewardsRedeemed} 項禮品`}
              accent
            />
          ) : (
            <SummaryTile
              label="點數帳本"
              value={formatNumber(customer._count.pointsLedger)}
              sub={customer._count.pointsLedger > 0 ? '筆流水' : '—'}
            />
          )}
          <SummaryTile
            label="訂閱"
            value={activeSub ? activeSub.plan.name : '—'}
            sub={activeSub ? '進行中' : `${customer._count.subscriptions} 筆合約`}
          />
        </div>

        {hasJar && jar ? (
          <SectionCard title="換罐會員" tone="supply" contentClassName="pt-6">
            <CustomerJarExchangePanel
              customerId={customer.id}
              customerName={customer.name}
              pointsBalance={jar.stats.pointsBalance}
              codesRedeemed={jar.stats.codesRedeemed}
              rewardsRedeemed={jar.stats.rewardsRedeemed}
              jarServiceStatus={jar.stats.jarServiceStatus}
              lastActivityAt={jar.stats.lastActivityAt}
              ledgerCount={jar.ledgerCount}
              redemptionCount={jar.redemptionCount}
              jarCodesCount={jar.jarCodesCount}
              redemptions={jar.redemptions.map((r) => ({
                redemptionCode: r.redemptionCode,
                rewardName: r.reward.rewardName,
                pointsSpent: r.pointsSpent,
                couponCode: r.couponCode,
                couponFaceValue: r.reward.couponFaceValue,
                issuedAt: r.issuedAt,
                couponStatus: r.couponStatus,
              }))}
              rewardOptions={jar.rewardOptions}
            />
          </SectionCard>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <CustomerContactCard customer={customer} tags={tags} />
            <CustomerOrdersPreview orders={customer.orders} totalCount={orderTotal} />
          </div>
          <div className="space-y-6 lg:col-span-2">
            <CustomerServicesBlock services={customer.services} />

            {customer.subscriptions.length > 0 ? (
              <SectionCard
                title="訂閱"
                description={`${customer._count.subscriptions} 筆合約`}
                tone="subscription"
                action={
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/subscriptions">全部</Link>
                  </Button>
                }
              >
                <ul className="space-y-2">
                  {customer.subscriptions.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/subscriptions/${s.id}`}
                        className="block rounded-xl border border-border/50 px-3 py-2.5 transition-colors hover:border-primary/20 hover:bg-muted/20"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{s.plan.name}</span>
                          <StatusBadge kind="subscription" value={s.status} />
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {s.subscriptionNo}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
