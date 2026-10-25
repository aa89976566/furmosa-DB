import Link from 'next/link';
import { PackagePlus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { COUNT_ROLES, inventoryUnit, type InventoryRow } from '@/lib/inventory/workbench';
import { InventoryWorkbench } from './inventory-workbench';
export const dynamic = 'force-dynamic';
export default async function InventoryPage(props: {
    searchParams: Promise<{
        q?: string;
    }>;
}) {
    const [query, user, products, pendingOrders] = await Promise.all([
        props.searchParams, getCurrentUser(),
        prisma.product.findMany({
            select: { id: true, productId: true, name: true, sku: true, sourceSku: true, category: true,
                unit: true, status: true, productCategory: true, vendorId: true,
                vendor: { select: { name: true } }, inventoryBalances: { select: {
                        quantity: true, unit: true, updatedAt: true, warehouse: { select: { code: true, name: true } },
                    } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        prisma.purchaseOrder.findMany({ where: { status: 'pending_receipt' },
            select: { id: true, orderNumber: true, vendor: { select: { name: true } }, _count: { select: { items: true } } },
            orderBy: [{ remindFromDate: 'asc' }, { createdAt: 'asc' }], take: 20 }),
    ]);
    const rows: InventoryRow[] = products.map(product => {
        const balance = product.inventoryBalances.find(b => b.warehouse.code === 'WH-MAIN');
        const unit = inventoryUnit(balance?.unit);
        return { id: product.id, productCode: product.productId, name: product.name,
            sku: product.sourceSku ?? product.sku, hqSku: product.sku, category: product.category,
            vendorId: product.vendorId, vendorName: product.vendor?.name ?? '',
            quantity: unit ? balance!.quantity : null, unit, version: balance?.updatedAt.toISOString() ?? null,
            canCount: !!unit && unit === inventoryUnit(product.unit) && product.status === 'active' && product.productCategory === 'STANDARD',
            canConfirmUnit: !!inventoryUnit(product.unit) && product.status === 'active' && product.productCategory === 'STANDARD'
                && (!balance || unit !== inventoryUnit(product.unit))
                && !product.inventoryBalances.some(b => b.warehouse.code !== 'WH-MAIN' && b.quantity !== 0),
            otherWarehouses: product.inventoryBalances.filter(b => b.warehouse.code !== 'WH-MAIN' && b.quantity !== 0)
                .map(b => ({ name: b.warehouse.name, quantity: b.quantity, unit: inventoryUnit(b.unit) })),
        };
    });
    const canEdit = !!user && COUNT_ROLES.includes(user.role);
    return <>
    <PageHeader title="庫存工作台" description="散裝看克數，成品依廠商查看；直接更新現場實際數量。" actions={canEdit ? <Button asChild className="min-h-11"><Link href="/inventory/purchase-orders/new"><PackagePlus className="mr-2 h-4 w-4"/>新增進貨</Link></Button> : undefined}/>
    <div className="space-y-6 p-4 md:p-6">
      <nav aria-label="庫存流程" className="flex flex-wrap gap-2 text-sm"><Link href="/inventory" aria-current="page" className="inline-flex min-h-11 items-center rounded-lg bg-secondary px-4 font-medium">現有庫存</Link><Link href="/inventory/purchases?view=pending" className="inline-flex min-h-11 items-center px-4 text-muted-foreground">待收貨</Link><Link href="/inventory/purchases" className="inline-flex min-h-11 items-center px-4 text-muted-foreground">入庫紀錄</Link></nav>
      {pendingOrders.length ? <section aria-label="待收貨進貨單" className="rounded-xl border bg-card"><div className="flex flex-wrap justify-between gap-3 border-b px-5 py-4"><div><h2 className="text-base font-semibold">待收貨</h2><p className="mt-1 text-sm text-muted-foreground">尚未計入庫存；實際到貨後再核對入庫。</p></div><Link href="/inventory/purchases?view=pending" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">查看全部</Link></div><div className="divide-y">{pendingOrders.slice(0, 3).map(order => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="text-sm font-medium">{order.vendor?.name ?? '未指定供應商'}</p><p className="mt-1 text-xs text-muted-foreground">{order.orderNumber} · {order._count.items} 項</p></div><Button asChild variant="outline" className="min-h-11"><Link href={`/inventory/purchase-orders/${order.id}`}>{canEdit ? '收到商品' : '查看內容'}</Link></Button></div>)}</div></section> : null}
      <InventoryWorkbench rows={rows} canEdit={canEdit} canVerifyUnits={user?.role === 'admin'} initialQuery={query.q}/>
    </div>
  </>;
}
