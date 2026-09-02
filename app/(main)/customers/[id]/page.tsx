import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Pencil, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CustomerContactCard } from '@/components/customers/customer-contact-card';
import { CustomerDeleteButton } from '@/components/customers/customer-delete-button';
import { CustomerMemberWorkspace } from '@/components/customers/customer-member-workspace';
import { loadCustomerDetail } from '@/lib/customers/load-customer-detail';
import { parseTags } from '@/lib/parse-tags';
import { formatNumber } from '@/lib/format';
import { customerServiceTypeLabel } from '@/lib/jar-exchange/labels';

export const dynamic = 'force-dynamic';

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 px-3 py-3.5 sm:px-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{formatNumber(value)}</p>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const data = await loadCustomerDetail(params.id);
  if (!data) notFound();

  const { customer, hasJar, issuedJars, openRefillOrders, pointsBalance } = data;
  const tags = parseTags(customer.tags);
  const orderTotal = customer._count.orders;
  const missingProfileCount = [customer.email, customer.address, customer.preferredShippingMethod].filter(
    (value) => !value,
  ).length;
  const attentionItems = [
    openRefillOrders.length > 0 && `${openRefillOrders.length} 筆換罐待處理`,
    data.draftOrderCount > 0 && `${data.draftOrderCount} 筆草稿訂單待確認`,
    missingProfileCount > 0 && `會員資料缺少 ${missingProfileCount} 項`,
  ].filter(Boolean) as string[];

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" aria-label="麵包屑">
              <Link href="/customers" className="hover:text-foreground">會員</Link>
              <span>/</span>
              <span>{customer.name}</span>
            </nav>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{customer.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="mr-2 text-lg text-muted-foreground">{customer.customerId}</span>
              {customer.lineUserId ? <Badge variant="outline" className="font-normal">LINE 已綁定</Badge> : null}
              {customer.services.filter((service) => service.serviceStatus === 'active').map((service) => (
                <Badge key={service.serviceType} variant="outline" className="font-normal">
                  {customerServiceTypeLabel[service.serviceType] ?? service.serviceType}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {customer.phone ? <Button variant="outline" className="rounded-lg border" asChild><a href={`tel:${customer.phone}`}><Phone className="mr-2 h-4 w-4" />撥打</a></Button> : null}
            <Button variant="outline" className="rounded-lg border" asChild><Link href={`/customers/${customer.id}/edit`}><Pencil className="mr-2 h-4 w-4" />編輯</Link></Button>
            {hasJar ? <Button className="rounded-lg border" asChild><Link href={`/customers/${customer.id}/points/adjust`}>調整點數</Link></Button> : null}
            <Button variant="ghost" asChild><Link href="/customers"><ArrowLeft className="mr-2 h-4 w-4" />返回</Link></Button>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 min-[900px]:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4 min-[900px]:sticky min-[900px]:top-6">
          <CustomerContactCard customer={customer} tags={tags} />
          <details className="rounded-2xl border border-border bg-card px-5">
            <summary className="cursor-pointer py-4 text-sm font-semibold text-muted-foreground">資料管理</summary>
            <div className="border-t border-border py-4">
              <CustomerDeleteButton id={customer.id} name={customer.name} orderCount={orderTotal} subscriptionCount={customer._count.subscriptions} />
            </div>
          </details>
        </aside>

        <section className="min-w-0">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-5 py-4">
            {attentionItems.length > 0 ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
            <div className="sm:flex sm:items-baseline sm:gap-6">
              <p className="text-sm font-semibold">{attentionItems.length > 0 ? '需要留意' : '目前沒有待處理事項'}</p>
              {attentionItems.length > 0 ? <p className="mt-1 text-sm text-muted-foreground sm:mt-0">{attentionItems.join(' · ')}</p> : null}
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 min-[900px]:grid-cols-5 min-[900px]:divide-y-0">
              <Metric label="可用點數" value={pointsBalance} />
              <Metric label="累計獲得" value={data.pointsTotals.totalEarned} />
              <Metric label="累計兌換點數" value={data.pointsTotals.totalRedeemed} />
              <Metric label="已輸入序號" value={data.usedCodeCount} />
              <Metric label="可用優惠券" value={data.availableCouponCount} />
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-1 border-t border-border px-5 py-3 text-sm text-muted-foreground">
              <span>持有罐 <strong className="ml-1 font-semibold text-foreground">{issuedJars.length}</strong></span>
              <span>待處理換罐 <strong className="ml-1 font-semibold text-foreground">{openRefillOrders.length}</strong></span>
              <span>草稿訂單 <strong className="ml-1 font-semibold text-foreground">{data.draftOrderCount}</strong></span>
            </div>
          </div>

          <div className="mt-3">
            <CustomerMemberWorkspace data={data} />
          </div>
        </section>
      </div>
    </main>
  );
}
