import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { VendorSettlementStatusControls } from './status-controls';

export const dynamic = 'force-dynamic';

const statusLabel: Record<string, string> = {
  draft: '草稿',
  reviewing: '核對中',
  approved: '已確認',
  paid: '已付款',
};

function snapshot(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export default async function VendorSettlementDetailPage(props: {
  params: Promise<{ id: string; settlementId: string }>;
}) {
  const { id: vendorId, settlementId } = await props.params;
  const [settlement, actor, auditLogs] = await Promise.all([
    prisma.vendorSettlement.findUnique({
      where: { id: settlementId },
      include: {
        vendor: { select: { id: true, name: true } },
        items: {
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
          include: {
            orderItem: {
              select: {
                productName: true,
                sku: true,
                quantity: true,
                weightGrams: true,
                unit: true,
                order: { select: { id: true, orderNumber: true } },
              },
            },
          },
        },
      },
    }),
    getCurrentUser(),
    prisma.statusAuditLog.findMany({
      where: { entityType: 'vendor_settlement', entityId: settlementId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        previousStatus: true,
        newStatus: true,
        actorId: true,
        actorType: true,
        metadataJson: true,
        createdAt: true,
      },
    }),
  ]);
  if (!settlement || settlement.vendorId !== vendorId) notFound();
  const periodEndInclusive = new Date(settlement.periodEnd.getTime() - 1);
  const actorIds = [...new Set(auditLogs.map((log) => log.actorId).filter((id): id is string => Boolean(id)))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorNames = new Map(actors.map((user) => [user.id, user.name]));

  return (
    <>
      <PageHeader
        title={settlement.settlementNumber}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{settlement.vendor.name}</span>
            <span>·</span>
            <span>{formatDate(settlement.periodStart)}–{formatDate(periodEndInclusive)}</span>
            <Badge variant="muted">{statusLabel[settlement.status] ?? settlement.status}</Badge>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/vendors/${vendorId}`}>
                <ArrowLeft className="mr-1 h-4 w-4" />返回供應商
              </Link>
            </Button>
            <VendorSettlementStatusControls
              vendorId={vendorId}
              settlementId={settlement.id}
              status={settlement.status}
              actorRole={actor?.role ?? ''}
            />
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="淨實收" value={formatCurrency(settlement.grossCollectedTwd - settlement.refundTwd)} />
          <Metric label="退款" value={formatCurrency(settlement.refundTwd)} />
          <Metric label="匠寵分潤" value={formatCurrency(settlement.furmosaShareTwd)} />
          <Metric label="應付供應商" value={formatCurrency(settlement.vendorPayableTwd)} strong />
        </div>

        <SectionCard
          title="銷售明細"
          description="每筆金額皆使用訂單建立時保存的供應商比例，折扣已按商品金額分攤"
          contentClassName="pt-0"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>訂單</TableHead>
                <TableHead>商品</TableHead>
                <TableHead>規格／數量</TableHead>
                <TableHead className="text-right">商品金額</TableHead>
                <TableHead className="text-right">分攤折扣</TableHead>
                <TableHead className="text-right">淨實收</TableHead>
                <TableHead className="text-right">匠寵</TableHead>
                <TableHead className="text-right">供應商</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlement.items.map((item) => {
                const source = snapshot(item.sourceSnapshot);
                const order = item.orderItem?.order;
                const productName = item.orderItem?.productName ?? (typeof source.productName === 'string' ? source.productName : '商品');
                const weight = item.orderItem?.weightGrams ?? (typeof source.weightGrams === 'number' ? source.weightGrams : null);
                const unit = item.orderItem?.unit ?? (typeof source.unit === 'string' ? source.unit : null);
                const quantity = item.orderItem?.quantity ?? (typeof source.quantity === 'number' ? source.quantity : null);
                const sourceSku = typeof source.sku === 'string' ? source.sku : '';
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {order ? <Link href={`/orders/${order.id}`} className="font-medium hover:underline">{order.orderNumber}</Link> : String(source.orderNumber ?? '-')}
                      <p className="text-xs text-muted-foreground">{formatDateTime(item.occurredAt)}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{productName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{item.orderItem?.sku ?? sourceSku}</p>
                    </TableCell>
                    <TableCell>{weight ? `${weight}g` : unit || '-'} × {String(quantity ?? '-')}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(source.lineSubtotalTwd ?? item.grossCollectedTwd))}</TableCell>
                    <TableCell className="text-right tabular-nums">-{formatCurrency(Number(source.allocatedDiscountTwd ?? 0))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(item.grossCollectedTwd - item.refundTwd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(item.furmosaShareTwd)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(item.vendorPayableTwd)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard
          title="操作紀錄"
          description="狀態、時間、操作者與付款憑證均保留，不以畫面文字取代稽核資料"
          contentClassName="pt-0"
        >
          {auditLogs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">尚無狀態操作紀錄。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>時間</TableHead>
                  <TableHead>操作者</TableHead>
                  <TableHead>狀態變更</TableHead>
                  <TableHead>付款註記</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => {
                  let paymentReference = '';
                  try {
                    const metadata = log.metadataJson ? JSON.parse(log.metadataJson) as unknown : null;
                    const record = snapshot(metadata);
                    paymentReference = typeof record.paymentReference === 'string' ? record.paymentReference : '';
                  } catch { /* 舊稽核資料沒有付款 JSON 時保持空白。 */ }
                  return (
                    <TableRow key={log.id}>
                      <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                      <TableCell>{log.actorId ? actorNames.get(log.actorId) ?? 'HQ 人員' : log.actorType}</TableCell>
                      <TableCell>
                        {log.previousStatus ? `${statusLabel[log.previousStatus] ?? log.previousStatus} → ` : ''}
                        {statusLabel[log.newStatus] ?? log.newStatus}
                      </TableCell>
                      <TableCell>{paymentReference || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        {settlement.paidAt ? (
          <p className="text-sm text-muted-foreground">
            付款標記時間：{formatDateTime(settlement.paidAt)}
            {settlement.note ? ` · ${settlement.note}` : ''}
          </p>
        ) : null}
      </div>
    </>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl tabular-nums ${strong ? 'font-bold' : 'font-semibold'}`}>{value}</p>
    </div>
  );
}
