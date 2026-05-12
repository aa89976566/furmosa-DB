import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { parsePlanContents, parsePlanBonus, parseShipDays } from '@/lib/subscription';
import { ArrowLeft, Check, Gift, Truck } from 'lucide-react';

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

  const contents = parsePlanContents(sub.plan.contents);
  const bonus = parsePlanBonus(sub.plan.bonusItems);
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

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <SectionCard title="客戶 & 收件" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
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
              value={<div className="text-right text-xs">{sub.shippingAddress}</div>}
            />
            {sub.notes && (
              <Row label="備註" value={<div className="text-right text-xs">{sub.notes}</div>} />
            )}
          </dl>
        </SectionCard>

        <SectionCard title="方案內容" className="lg:col-span-1">
          <div className="space-y-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{sub.plan.planCode}</p>
              <h3 className="text-xl font-bold">{sub.plan.name}</h3>
              {sub.plan.tagline && (
                <p className="text-xs text-muted-foreground">{sub.plan.tagline}</p>
              )}
            </div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(Number(sub.plan.monthlyPrice))}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ 月</span>
            </div>
            {sub.billingCycle === 'halfyear' && sub.plan.halfYearPrice && (
              <Badge variant="success">
                半年付清 {formatCurrency(Number(sub.plan.halfYearPrice))}
                {sub.plan.halfYearSavings && (
                  <> · 省 {formatCurrency(Number(sub.plan.halfYearSavings))}</>
                )}
              </Badge>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-info" />
              每月 {sub.plan.shipmentsPerMonth} 次（
              {shipDays.map((d) => `${d}日`).join(' / ')}）
            </div>
            <div className="space-y-1 border-t pt-3 text-sm">
              {contents.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>
                    <span className="font-medium">{c.name}</span>
                    {c.weight && (
                      <span className="ml-1 text-xs text-muted-foreground">({c.weight})</span>
                    )}
                  </span>
                </div>
              ))}
              {bonus.map((b, i) => (
                <div key={`b-${i}`} className="flex items-start gap-2">
                  <Gift className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>{b.name}</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" asChild className="w-full">
              <Link href="/subscriptions/plans">查看所有方案</Link>
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="訂閱統計" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="開始日" value={formatDate(sub.startDate)} />
            <Stat
              label="到期日"
              value={sub.endDate ? formatDate(sub.endDate) : '無限期'}
            />
            <Stat
              label="下次出貨"
              value={
                sub.status === 'active' && sub.nextShipmentDate
                  ? formatDate(sub.nextShipmentDate)
                  : '-'
              }
              note={sub.status === 'active' ? '依方案排程' : '未進行中'}
            />
            <Stat
              label="出貨進度"
              value={`${completedShip} / ${totalShip}`}
              note="已寄 / 全部排程"
            />
          </div>
        </SectionCard>

        <SectionCard
          title="出貨明細"
          description="此合約下所有歷史與未來排定的出貨"
          className="lg:col-span-3"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>出貨單號</TableHead>
                <TableHead>排定日期</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>包裝</TableHead>
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
                    {s.packedAt ? formatDateTime(s.packedAt) : '-'}
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
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
      {note && <div className="text-[11px] text-muted-foreground">{note}</div>}
    </div>
  );
}
