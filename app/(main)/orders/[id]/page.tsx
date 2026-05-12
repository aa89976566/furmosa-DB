import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { ArrowLeft, AlertTriangle, Phone, MapPin, StickyNote } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      merchant: true,
      items: { include: { product: true } },
    },
  });
  if (!order) notFound();

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        description={`下單時間 ${formatDateTime(order.orderedAt)}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <SectionCard title="訂單摘要" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <Row label="訂單編號" value={<span className="font-mono">{order.orderNumber}</span>} />
            <Row label="來源" value={<StatusBadge kind="orderSource" value={order.source} />} />
            <Row label="狀態" value={<StatusBadge kind="order" value={order.status} />} />
            <Row label="付款狀態" value={<StatusBadge kind="payment" value={order.paymentStatus} />} />
            <Row label="出貨狀態" value={<StatusBadge kind="fulfillment" value={order.fulfillmentStatus} />} />
            <Row
              label="客戶"
              value={
                order.customer ? (
                  <Link
                    href={`/customers/${order.customer.id}`}
                    className="text-info hover:underline"
                  >
                    {order.customer.name}
                  </Link>
                ) : (
                  '-'
                )
              }
            />
            {order.customer?.phone && (
              <Row
                label="電話"
                value={
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {order.customer.phone}
                  </span>
                }
              />
            )}
            <Row
              label="寄賣店家"
              value={
                order.merchant ? (
                  <Link
                    href={`/merchants/${order.merchant.id}`}
                    className="text-info hover:underline"
                  >
                    {order.merchant.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )
              }
            />
            <Row
              label="送貨地址"
              value={
                order.shippingAddress ? (
                  <span className="inline-flex items-start gap-1">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <span>{order.shippingAddress}</span>
                  </span>
                ) : order.customer?.address ? (
                  <span className="inline-flex items-start gap-1 text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{order.customer.address}（客戶預設）</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )
              }
            />
            {order.completedAt ? (
              <Row label="完成時間" value={formatDateTime(order.completedAt)} />
            ) : null}
          </dl>

          {order.note && (
            <div className="mt-4 flex gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-pre-line">{order.note}</span>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="訂單品項"
          description={`${order.items.length} 項 · 共 ${order.items.reduce((s, i) => s + i.quantity, 0)} 件`}
          className="lg:col-span-2"
        >
          {(() => {
            const incomplete = order.items.filter(
              (it) => Number(it.unitPrice) === 0 || !it.sku || it.sku.startsWith('FUR-'),
            );
            return incomplete.length > 0 ? (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  有 <span className="font-semibold">{incomplete.length}</span> 個品項缺欄位（SKU
                  自動帶入或單價未填）— 請出貨前回試算表 / 系統補完。
                </span>
              </div>
            ) : null;
          })()}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">重量</TableHead>
                <TableHead className="text-center">單位</TableHead>
                <TableHead className="text-right">數量</TableHead>
                <TableHead className="text-right">單價</TableHead>
                <TableHead className="text-right">小計</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((it) => {
                const skuMissing = !it.sku || it.sku.startsWith('FUR-');
                const priceMissing = Number(it.unitPrice) === 0;
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <Link
                        href={`/products/${it.productId}`}
                        className="font-medium hover:underline"
                      >
                        {it.productName}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {skuMissing ? (
                        <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          {it.sku || '未填'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{it.sku}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {it.weightGrams ? `${it.weightGrams}g` : '-'}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {it.unit ?? '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">{it.quantity}</TableCell>
                    <TableCell className="text-right">
                      {priceMissing ? (
                        <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          未填
                        </span>
                      ) : (
                        formatCurrency(Number(it.unitPrice))
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {priceMissing ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        formatCurrency(Number(it.subtotal))
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-6 ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">小計</span>
              <span>{formatCurrency(Number(order.subtotal))}</span>
            </div>
            {Number(order.discount) > 0 ? (
              <div className="flex justify-between text-success">
                <span>折扣</span>
                <span>- {formatCurrency(Number(order.discount))}</span>
              </div>
            ) : null}
            {Number(order.shippingFee) > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">運費</span>
                <span>{formatCurrency(Number(order.shippingFee))}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>合計</span>
              <span>{formatCurrency(Number(order.total))}</span>
            </div>
            {order.pointsEarned > 0 ? (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>本訂單獲得點數</span>
                <span>{order.pointsEarned} 點</span>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="活動紀錄"
          description="訂單流程時間軸"
          className="lg:col-span-3"
        >
          <ol className="relative ml-3 space-y-4 border-l pl-6">
            <TimelineItem
              time={order.orderedAt}
              title="訂單建立"
              description={`來源：${order.source}`}
            />
            {order.status !== 'draft' ? (
              <TimelineItem
                time={order.orderedAt}
                title="訂單確認"
                description={`付款狀態：${order.paymentStatus}`}
              />
            ) : null}
            {['shipped', 'delivered', 'completed'].includes(order.status) ? (
              <TimelineItem
                time={order.shippedAt ?? order.orderedAt}
                title="已出貨"
                description="運送中"
              />
            ) : null}
            {order.completedAt ? (
              <TimelineItem
                time={order.completedAt}
                title="訂單完成"
                description={`累計獲得 ${order.pointsEarned} 點`}
              />
            ) : null}
          </ol>
        </SectionCard>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function TimelineItem({
  time,
  title,
  description,
}: {
  time: Date;
  title: string;
  description?: string;
}) {
  return (
    <li className="relative">
      <span className="absolute -left-[31px] top-1 flex h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <p className="text-xs text-muted-foreground">{formatDateTime(time)}</p>
    </li>
  );
}
