import Link from 'next/link';
import { AlertTriangle, Search, ShoppingCart } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import { formatTaipeiCalendarDate } from '@/lib/inventory/purchase-orders';

export const dynamic = 'force-dynamic';

export default async function InventoryPage(props: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await props.searchParams;
  const query = q.trim();
  const [products, pendingOrders] = await Promise.all([
    prisma.product.findMany({
      where: query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { sku: { contains: query, mode: 'insensitive' } }, { productId: { contains: query, mode: 'insensitive' } }] } : undefined,
      select: {
        id: true, productId: true, name: true, sku: true, sourceSku: true, category: true, unit: true, reorderPoint: true, averageCostPerGram: true,
        inventoryBalances: { select: { quantity: true, unit: true, lastCountedAt: true, warehouse: { select: { code: true } } } },
      },
      orderBy: { productId: 'asc' },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: 'pending_receipt' },
      select: { id: true, remindFromDate: true, totalAmount: true, vendor: { select: { name: true } }, items: { select: { quantityGrams: true } }, _count: { select: { items: true } } },
      orderBy: [{ remindFromDate: 'asc' }, { createdAt: 'asc' }],
      take: 20,
    }),
  ]);

  const rows = products.map((product) => {
    const mainBalance = product.inventoryBalances.find((item) => item.warehouse.code === 'WH-MAIN');
    const main = mainBalance?.quantity ?? 0;
    const south = product.inventoryBalances.find((item) => item.warehouse.code === 'WH-SOUTH')?.quantity ?? 0;
    const consign = product.inventoryBalances.find((item) => item.warehouse.code === 'WH-CONSIGN')?.quantity ?? 0;
    const total = main + south + consign;
    const isFood = ['staple_food', 'treats', 'freeze_dried', 'health'].includes(product.category);
    const counted = Boolean(mainBalance?.unit && mainBalance.lastCountedAt);
    const low = isFood ? !counted || main === 0 : total <= product.reorderPoint;
    return { product, mainBalance, main, south, consign, total, isFood, counted, low };
  });
  const lowCount = rows.filter((row) => row.low).length;
  const nextOrder = pendingOrders[0];
  const nextOrderGrams = nextOrder?.items.reduce((sum, item) => sum + item.quantityGrams, 0) ?? 0;

  return <>
    <PageHeader title="庫存" description="現有庫存、待收貨採購與入庫紀錄集中管理" actions={<Button asChild><Link href="/inventory/purchase-orders/new"><ShoppingCart className="mr-2 h-4 w-4" />新增採購單</Link></Button>} />
    <div className="space-y-6 p-4 md:p-6">
      {nextOrder ? (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">待收貨 {pendingOrders.length}</span>
              <Badge variant="warning">尚未入庫</Badge>
              <span className="text-sm text-muted-foreground">{nextOrder.vendor?.name ?? '未指定供應商'}</span>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {nextOrder._count.items} 項 · {formatNumber(nextOrderGrams)} g · {formatCurrency(Number(nextOrder.totalAmount))} · {formatTaipeiCalendarDate(nextOrder.remindFromDate).slice(5).replace('-', '/')} 起提醒
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/inventory/purchases?view=pending">查看待收貨</Link>
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        <nav className="overflow-x-auto" aria-label="庫存分類">
          <div className="inline-flex min-w-full gap-1 rounded-xl border border-border/70 bg-card p-1.5 sm:min-w-0">
            <Link href="/inventory" aria-current="page" className="inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-black px-3 text-sm font-medium text-white shadow-sm sm:min-w-28 sm:flex-none">現有庫存</Link>
            <Link href="/inventory/purchases?view=pending" className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:min-w-32 sm:flex-none">待收貨 <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{pendingOrders.length}</span></Link>
            <Link href="/inventory/purchases" className="inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:min-w-28 sm:flex-none">已入庫</Link>
          </div>
        </nav>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form className="relative min-w-0 flex-1 lg:max-w-2xl" action="/inventory">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={query} placeholder="搜尋商品或 SKU" className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
          </form>
          <div className="inline-flex overflow-hidden rounded-lg border border-border/70 bg-card text-xs">
            <Metric label="品項" value={products.length} />
            <Metric label="低庫存" value={lowCount} emphasis={lowCount > 0} />
            <Metric label="待收貨" value={pendingOrders.length} />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[15rem]">商品</TableHead>
              <TableHead className="text-right">HQ 庫存</TableHead>
              <TableHead className="text-right">其他倉</TableHead>
              <TableHead className="text-right">成本 / g</TableHead>
              <TableHead className="min-w-[11rem]">狀態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map(({ product, mainBalance, main, south, consign, total, isFood, counted, low }) => (
              <TableRow key={product.id}>
                <TableCell>
                  <Link href={`/products/${product.id}`} className="font-medium hover:underline">{product.name}</Link>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {product.sourceSku ?? product.sku}
                    {product.sourceSku ? <span className="ml-2 opacity-70">HQ {product.sku}</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{product.productId}</div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-semibold tabular-nums">{formatNumber(main)} {mainBalance?.unit ?? (isFood ? '（舊數字）' : product.unit)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{counted ? '已盤點' : '尚未盤點'}</div>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  <div>南倉 {formatNumber(south)}</div>
                  <div>寄賣 {formatNumber(consign)}</div>
                  {!counted ? <div className="mt-1">舊合計 {formatNumber(total)}</div> : null}
                </TableCell>
                <TableCell className="text-right">
                  {product.averageCostPerGram == null ? <span className="text-muted-foreground">尚未建檔</span> : `NT${Number(product.averageCostPerGram).toFixed(4)}`}
                </TableCell>
                <TableCell>
                  {low ? <Badge variant="warning"><AlertTriangle className="mr-1 h-3 w-3" />{isFood && !counted ? '待實體盤點' : '低庫存'}</Badge> : <Badge variant="success">正常</Badge>}
                  <div className="mt-1 text-xs text-muted-foreground">{mainBalance?.lastCountedAt ? formatDateTime(mainBalance.lastCountedAt) : '尚未盤點'}</div>
                  <Link href={`/inventory/stocktake/${product.id}`} className="mt-1 inline-flex text-xs font-semibold underline underline-offset-4">調整庫存</Link>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">找不到符合條件的商品。</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  </>;
}

function Metric({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 border-r border-border/70 px-3 py-2 last:border-r-0">
      <span className="text-muted-foreground">{label}</span>
      <strong className={emphasis ? 'text-warning' : 'text-foreground'}>{value}</strong>
    </span>
  );
}
