import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { LinkifiedText } from '@/components/shared/linkified-text';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatDateTime } from '@/lib/format';
import { parsePlanContents, parsePlanBonus, parseShipDays } from '@/lib/subscription';
import { SubscriptionSettingsForm } from './subscription-settings-form';
import { SubscriptionContentsCard } from '@/components/subscriptions/subscription-contents-card';
import { SubscriptionStatsCard } from '@/components/subscriptions/subscription-stats-card';
import { SubscriptionNotesEditor } from '@/components/subscriptions/subscription-notes-editor';
import { ArrowLeft } from 'lucide-react';

function toDateInput(d: Date | null | undefined): string {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const dynamic = 'force-dynamic';

export default async function SubscriptionDetailPage({ params }: { params: { id: string } }) {
  const sub = await prisma.subscription.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      plan: true,
      shipments: { orderBy: { scheduledDate: 'asc' } },
    },
  });
  if (!sub) notFound();

  const plans = await prisma.subscriptionPlan.findMany({
    where: {
      OR: [{ isActive: true }, { id: sub.planId }],
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      planCode: true,
      name: true,
      monthlyPrice: true,
    },
  });

  const planContents = parsePlanContents(sub.plan.contents);
  const planBonus = parsePlanBonus(sub.plan.bonusItems);
  const customContents = parsePlanContents(sub.customContents);
  const customBonus = parsePlanBonus(sub.customBonus);
  const isCustom = sub.customContents != null;
  const effectiveContents = isCustom ? customContents : planContents;
  const effectiveBonus = isCustom ? customBonus : planBonus;
  const shipDays = parseShipDays(sub.plan.shipDays);
  const totalShip = sub.shipments.length;
  const completedShip = sub.shipments.filter(
    (s) => s.status === 'shipped' || s.status === 'delivered',
  ).length;

  return (
    <>
      <PageHeader
        title={`${sub.customer.name} - ${sub.plan.name}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{sub.subscriptionNo}</span>
            <StatusBadge kind="subscription" value={sub.status} />
            <StatusBadge kind="subscriptionCycle" value={sub.billingCycle} />
          </span>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/subscriptions">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />

      <div className="grid min-w-0 gap-6 p-6 lg:grid-cols-3">
        <SectionCard
          title="客戶 & 收件"
          className="min-w-0 lg:col-span-1"
          contentClassName="min-w-0 pt-6"
        >
          <dl className="min-w-0 space-y-2 text-sm">
            <Row
              label="客戶"
              value={
                <Link href={`/customers/${sub.customer.id}`} className="text-info hover:underline">
                  {sub.customer.name}
                </Link>
              }
            />
            <Row
              label="客戶編號"
              value={<span className="font-mono text-xs">{sub.customer.customerId}</span>}
            />
            <Row label="收件人" value={sub.recipientName} />
            <Row label="收件電話" value={sub.recipientPhone} />
            <Row
              label="收件地址"
              value={
                sub.shippingAddress ? (
                  <LinkifiedText
                    text={sub.shippingAddress}
                    className="block text-right break-words [overflow-wrap:anywhere]"
                  />
                ) : (
                  '—'
                )
              }
            />
          </dl>
          <div className="mt-3 space-y-1.5 border-t pt-3">
            <p className="text-xs text-muted-foreground">備註</p>
            <SubscriptionNotesEditor subscriptionId={sub.id} notes={sub.notes ?? ''} />
          </div>
        </SectionCard>

        <SectionCard title="方案內容" className="min-w-0 lg:col-span-1" contentClassName="min-w-0 pt-6">
          <SubscriptionContentsCard
            data={{
              subscriptionId: sub.id,
              planCode: sub.plan.planCode,
              planName: sub.plan.name,
              tagline: sub.plan.tagline,
              monthlyPrice: Number(sub.plan.monthlyPrice),
              billingCycle: sub.billingCycle,
              halfYearPrice: sub.plan.halfYearPrice == null ? null : Number(sub.plan.halfYearPrice),
              halfYearSavings:
                sub.plan.halfYearSavings == null ? null : Number(sub.plan.halfYearSavings),
              shipmentsPerMonth: sub.plan.shipmentsPerMonth,
              shipDays,
              contents: effectiveContents,
              bonus: effectiveBonus,
              isCustom,
            }}
          />
        </SectionCard>

        <SectionCard title="訂閱統計" className="min-w-0 lg:col-span-1" contentClassName="min-w-0 pt-6">
          <SubscriptionStatsCard
            data={{
              subscriptionId: sub.id,
              statusActive: sub.status === 'active',
              startInput: toDateInput(sub.startDate),
              endInput: toDateInput(sub.endDate),
              nextInput: toDateInput(sub.nextShipmentDate),
              startLabel: formatDate(sub.startDate),
              endLabel: sub.endDate ? formatDate(sub.endDate) : '無限期',
              nextLabel:
                sub.status === 'active' && sub.nextShipmentDate
                  ? formatDate(sub.nextShipmentDate)
                  : '-',
              nextNote: sub.status === 'active' ? '依方案排程' : '未進行中',
              progressLabel: `${completedShip} / ${totalShip}`,
              paymentType: sub.paymentType,
              paymentNote: sub.paymentNote ?? '',
            }}
          />
        </SectionCard>

        <SectionCard
          title="訂閱設定"
          description="更換方案或調整到期日"
          className="min-w-0 lg:col-span-3"
          contentClassName="min-w-0 pt-6"
        >
          <SubscriptionSettingsForm
            subscriptionId={sub.id}
            currentPlanId={sub.planId}
            currentEndDate={sub.endDate}
            currentPaymentType={sub.paymentType}
            currentPaymentNote={sub.paymentNote ?? ''}
            plans={plans.map((plan) => ({
              ...plan,
              monthlyPrice: Number(plan.monthlyPrice),
            }))}
          />
        </SectionCard>

        <SectionCard
          title="出貨明細"
          description="此合約下所有歷史與未來排定的出貨"
          className="min-w-0 lg:col-span-3"
          contentClassName="min-w-0 overflow-x-auto pt-6"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>出貨單號</TableHead>
                <TableHead>排定日期</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>出貨</TableHead>
                <TableHead>送達</TableHead>
                <TableHead>追蹤碼</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sub.shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.shipmentNo}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {formatDate(s.scheduledDate)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="subscriptionShipment" value={s.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.shippedAt ? formatDateTime(s.shippedAt) : '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.deliveredAt ? formatDateTime(s.deliveredAt) : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.trackingNo ?? '-'}
                  </TableCell>
                </TableRow>
              ))}
              {sub.shipments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    尚無出貨排程
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SectionCard>
      </div>
    </>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 pb-2 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 max-w-full flex-1 text-sm font-medium sm:text-right">{value}</dd>
    </div>
  );
}
