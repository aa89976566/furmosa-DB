import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Pencil, Repeat } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { SummaryTile } from '@/components/customers/customer-detail-ui';
import { CustomerContactCard } from '@/components/customers/customer-contact-card';
import { CustomerJarOverview } from '@/components/customers/customer-jar-overview';
import { CustomerOrdersPreview } from '@/components/customers/customer-orders-preview';
import { CustomerDeleteButton } from '@/components/customers/customer-delete-button';
import { CustomerDetailTabs } from '@/components/customers/customer-detail-tabs';
import { CustomerActivityTimeline } from '@/components/customers/customer-activity-timeline';
import {
  CustomerIssuedJars,
  CustomerOpenRefills,
  CustomerRecentAppointments,
} from '@/components/customers/customer-crm-sections';
import { loadCustomerDetail } from '@/lib/customers/load-customer-detail';
import { parseTags } from '@/lib/parse-tags';
import { formatNumber } from '@/lib/format';
import { customerServiceTypeLabel } from '@/lib/jar-exchange/labels';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const data = await loadCustomerDetail(params.id);
  if (!data) notFound();

  const { customer, hasJar, issuedJars, recentAppointments, openRefillOrders, pointsBalance } = data;
  const tags = parseTags(customer.tags);
  const activeSub = customer.subscriptions.find((subscription) => subscription.status === 'active');
  const orderTotal = customer._count.orders;
  const missingProfileCount = [customer.email, customer.address, customer.preferredShippingMethod].filter(
    (value) => !value,
  ).length;
  const attentionItems = [
    openRefillOrders.length > 0 && `${openRefillOrders.length} 筆換罐待處理`,
    data.draftOrderCount > 0 && `${data.draftOrderCount} 筆草稿訂單待確認`,
    missingProfileCount > 0 && `會員資料缺少 ${missingProfileCount} 項`,
  ].filter(Boolean) as string[];

  const overview = (
    <div className="space-y-6">
      {openRefillOrders.length > 0 ? <CustomerOpenRefills orders={openRefillOrders} /> : null}
      <CustomerJarOverview data={data} />
      <CustomerOrdersPreview orders={customer.orders} totalCount={orderTotal} />
      {issuedJars.length > 0 ? <CustomerIssuedJars jars={issuedJars} /> : null}
      {recentAppointments.length > 0 ? (
        <CustomerRecentAppointments appointments={recentAppointments} />
      ) : null}
      {customer.subscriptions.length > 0 ? (
        <SectionCard
          title="訂閱"
          description={`${customer._count.subscriptions} 筆合約`}
          tone="subscription"
          action={<Button variant="ghost" size="sm" asChild><Link href="/subscriptions">全部</Link></Button>}
        >
          <ul className="divide-y divide-border">
            {customer.subscriptions.map((subscription) => (
              <li key={subscription.id}>
                <Link href={`/subscriptions/${subscription.id}`} className="flex items-center justify-between gap-3 py-4 transition-colors hover:bg-muted/25">
                  <div>
                    <p className="text-sm font-medium">{subscription.plan.name}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{subscription.subscriptionNo}</p>
                  </div>
                  <StatusBadge kind="subscription" value={subscription.status} />
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );

  return (
    <>
      <PageHeader
        tone="master"
        title={customer.name}
        description={
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs tracking-wide text-foreground/70">{customer.customerId}</span>
            {customer.lineUserId ? <Badge variant="success">LINE 已綁定</Badge> : null}
            {customer.services.filter((service) => service.serviceStatus === 'active').map((service) => (
              <Badge key={service.serviceType} variant="secondary">
                {customerServiceTypeLabel[service.serviceType] ?? service.serviceType}
              </Badge>
            ))}
            {activeSub ? <Badge variant="info" className="gap-1"><Repeat className="h-3 w-3" />{activeSub.plan.name}</Badge> : null}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {customer.phone ? <Button variant="outline" size="sm" asChild><a href={`tel:${customer.phone}`}>撥打</a></Button> : null}
            <Button variant="outline" size="sm" asChild><Link href={`/customers/${customer.id}/edit`}><Pencil className="mr-1 h-4 w-4" />編輯</Link></Button>
            {hasJar ? <Button size="sm" asChild><Link href={`/customers/${customer.id}/points/adjust`}>調整點數</Link></Button> : null}
            <Button variant="ghost" size="sm" asChild><Link href="/customers"><ArrowLeft className="mr-1 h-4 w-4" />返回</Link></Button>
          </div>
        }
      />

      <main className="mx-auto max-w-6xl p-6 pb-12">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(270px,0.78fr)_minmax(0,2fr)]">
          <aside className="space-y-5 lg:sticky lg:top-6">
            <CustomerContactCard customer={customer} tags={tags} />
            <details className="rounded-2xl border border-border bg-card px-4 shadow-card">
              <summary className="cursor-pointer py-4 text-sm font-semibold text-muted-foreground">資料管理</summary>
              <div className="border-t border-border py-4">
                <CustomerDeleteButton id={customer.id} name={customer.name} orderCount={orderTotal} subscriptionCount={customer._count.subscriptions} />
              </div>
            </details>
          </aside>

          <section className="min-w-0 space-y-6">
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-foreground">
              {attentionItems.length > 0 ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">{attentionItems.length > 0 ? '需要留意' : '目前沒有待處理事項'}</p>
                {attentionItems.length > 0 ? <p className="mt-1 text-xs opacity-80">{attentionItems.join(' · ')}</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <SummaryTile label="可用點數" value={formatNumber(pointsBalance)} sub={hasJar ? '換罐會員' : '點數帳本'} href={hasJar ? `/customers/${customer.id}/jar-ledger` : undefined} />
              <SummaryTile label="持有罐" value={formatNumber(issuedJars.length)} sub="已交付未返還" />
              <SummaryTile label="待處理換罐" value={formatNumber(openRefillOrders.length)} sub={openRefillOrders.length > 0 ? '請優先處理' : '目前無待辦'} />
              <SummaryTile label="訂單" value={formatNumber(orderTotal)} sub={data.draftOrderCount > 0 ? `${data.draftOrderCount} 筆草稿` : '無草稿'} />
            </div>

            <CustomerDetailTabs overview={overview} activity={<CustomerActivityTimeline data={data} />} />
          </section>
        </div>
      </main>
    </>
  );
}
