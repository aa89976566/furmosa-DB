import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Box, Package, Search, ShoppingCart } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
        id: true, productId: true, name: true, sku: true, category: true, unit: true, reorderPoint: true, averageCostPerGram: true,
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
      {nextOrder ? <Card className="border-warning/40 bg-warning/5 p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4"><div className="rounded-full bg-warning/15 p-3 text-warning"><ShoppingCart className="h-6 w-6" /></div><div>
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">待收貨採購 {pendingOrders.length} 筆</h2><Badge variant="warning">尚未入庫</Badge></div>
          <p className="mt-1 text-sm">{nextOrder.vendor?.name ?? '未指定供應商'} · 預計 {formatTaipeiCalendarDate(nextOrder.remindFromDate).slice(5).replace('-', '/')} 起提醒</p>
          <p className="mt-1 text-sm text-muted-foreground">{nextOrder._count.items} 項 · {formatNumber(nextOrderGrams)} g · {formatCurrency(Number(nextOrder.totalAmount))}</p>
        </div></div><Button asChild><Link href="/inventory/purchases?view=pending">查看待收貨</Link></Button>
      </div></Card> : null}

      <nav className="flex overflow-x-auto border-b" aria-label="庫存分類">
        <Link href="/inventory" className="min-w-36 border-b-2 border-primary bg-primary/5 px-6 py-3 text-center font-semibold text-primary">現有庫存</Link>
        <Link href="/inventory/purchases?view=pending" className="min-w-44 px-6 py-3 text-center font-medium text-muted-foreground hover:bg-muted/40">待收貨採購 {pendingOrders.length ? <span className="ml-1 rounded-full bg-warning/15 px-2 py-0.5 text-warning">{pendingOrders.length}</span> : null}</Link>
        <Link href="/inventory/purchases" className="min-w-40 px-6 py-3 text-center font-medium text-muted-foreground hover:bg-muted/40">已入庫紀錄</Link>
      </nav>

      <form className="relative max-w-2xl" action="/inventory"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input name="q" defaultValue={query} placeholder="搜尋商品或 SKU" className="h-12 w-full rounded-xl border bg-background pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20" /></form>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="庫存品項" value={products.length} icon={<Box className="h-6 w-6" />} tone="green" />
        <SummaryCard label="低庫存" value={lowCount} icon={<AlertCircle className="h-6 w-6" />} />
        <SummaryCard label="待收貨" value={pendingOrders.length} icon={<Package className="h-6 w-6" />} />
      </div>

      <Card className="overflow-hidden"><Table><TableHeader><TableRow><TableHead>商品</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">總倉</TableHead><TableHead className="text-right">南倉</TableHead><TableHead className="text-right">寄賣</TableHead><TableHead className="text-right">合計</TableHead><TableHead className="text-right">平均成本/g</TableHead><TableHead>狀態</TableHead></TableRow></TableHeader>
        <TableBody>{rows.length ? rows.map(({ product, mainBalance, main, south, consign, total, isFood, counted, low }) => <TableRow key={product.id}>
          <TableCell><Link href={`/products/${product.id}`} className="font-medium hover:underline">{product.name}</Link><div className="text-xs text-muted-foreground">{product.productId}</div><Link href={`/inventory/stocktake/${product.id}`} className="text-xs font-medium text-primary hover:underline">調整庫存</Link></TableCell>
          <TableCell>{product.sku}</TableCell><TableCell className="text-right">{formatNumber(main)} {mainBalance?.unit ?? (isFood ? '（舊數字）' : product.unit)}</TableCell><TableCell className="text-right text-muted-foreground">{formatNumber(south)}</TableCell><TableCell className="text-right text-muted-foreground">{formatNumber(consign)}</TableCell><TableCell className="text-right font-semibold">{counted ? `${formatNumber(main)} ${mainBalance?.unit}（HQ）` : `${formatNumber(total)}（舊合計）`}</TableCell><TableCell className="text-right">{product.averageCostPerGram == null ? '尚未建檔' : `NT$${Number(product.averageCostPerGram).toFixed(4)}`}</TableCell>
          <TableCell>{low ? <Badge variant="warning"><AlertTriangle className="mr-1 h-3 w-3" />{isFood && !counted ? '待實體盤點' : '低庫存'}</Badge> : <Badge variant="success">正常</Badge>}<div className="mt-1 text-xs text-muted-foreground">{mainBalance?.lastCountedAt ? formatDateTime(mainBalance.lastCountedAt) : '尚未盤點'}</div></TableCell>
        </TableRow>) : <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">找不到符合條件的商品。</TableCell></TableRow>}</TableBody>
      </Table></Card>
    </div>
  </>;
}

function SummaryCard({ label, value, icon, tone = 'amber' }: { label: string; value: number; icon: ReactNode; tone?: 'green' | 'amber' }) {
  const green = tone === 'green';
  return <Card className={`flex items-center justify-between p-5 ${green ? 'border-primary/20 bg-primary/5' : 'border-warning/30 bg-warning/5'}`}><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p></div><div className={`rounded-full p-3 ${green ? 'bg-primary/10 text-primary' : 'bg-warning/15 text-warning'}`}>{icon}</div></Card>;
}
