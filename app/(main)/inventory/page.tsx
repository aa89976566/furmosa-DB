import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

import { COUNT_ROLES, inventoryUnit, type InventoryRow } from '@/lib/inventory/workbench';
import './inventory-overview.css';
import { InventoryWorkbench } from './inventory-workbench';
export const dynamic = 'force-dynamic';
export default async function InventoryPage(props: {
    searchParams: Promise<{
        q?: string;
    }>;
}) {
    const [query, user, products, pendingCount, pendingOrders] = await Promise.all([
        props.searchParams, getCurrentUser(),
        prisma.product.findMany({
            select: { id: true, productId: true, name: true, sku: true, sourceSku: true, category: true, imageUrl: true,
                unit: true, status: true, productCategory: true, vendorId: true, reorderPoint: true,
                priceTiers: { where: { status: 'active' }, select: { id: true, weightGrams: true, unit: true, unitQty: true } },
                merchantStocks: { select: { merchantId: true, quantity: true, tierId: true, merchant: { select: { name: true } } } },
                vendor: { select: { name: true } }, inventoryBalances: { select: {
                        quantity: true, unit: true, updatedAt: true, lastCountedAt: true, warehouse: { select: { code: true, name: true } },
                    } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        prisma.purchaseOrder.count({ where: { status: 'pending_receipt' } }),
        prisma.purchaseOrder.findMany({ where: { status: 'pending_receipt' },
            select: { id: true, orderNumber: true, vendorId: true, warehouseId: true, totalAmount: true, note: true, items: { select: { productId: true, quantityGrams: true, rawAmount: true } }, vendor: { select: { name: true } }, _count: { select: { items: true } } },
            orderBy: [{ remindFromDate: 'asc' }, { createdAt: 'asc' }], take: 100 }),
    ]);
    const rows: InventoryRow[] = products.map(product => {
        const balance = product.inventoryBalances.find(b => b.warehouse.code === 'WH-MAIN');
        const unit = inventoryUnit(balance?.unit);
        return { id: product.id, imageUrl: product.imageUrl, status: product.status, productCategory: product.productCategory, productCode: product.productId, name: product.name,
            sku: product.sourceSku ?? product.sku, hqSku: product.sku, category: product.category,
            vendorId: product.vendorId, vendorName: product.vendor?.name ?? '',
            reorderPoint: product.reorderPoint, lastCountedAt: balance?.lastCountedAt?.toISOString() ?? null,
            priceTiers: product.priceTiers,
            merchantStocks: product.merchantStocks.map(stock => {
                const tier = product.priceTiers.find(t => t.id === stock.tierId);
                return { merchantId: stock.merchantId, merchantName: stock.merchant.name, quantity: stock.quantity,
                    tierLabel: tier ? tier.weightGrams ? `${tier.weightGrams}g` : `${tier.unitQty}${tier.unit}` : '舊規格待核對' };
            }),
            quantity: unit ? balance!.quantity : null, unit, version: balance?.updatedAt.toISOString() ?? null,
            canCount: !!unit && unit === inventoryUnit(product.unit) && product.status === 'active' && product.productCategory === 'STANDARD',
            countBlockedReason: product.status !== 'active' ? '商品已停用，請先確認商品狀態' : product.productCategory !== 'STANDARD' ? '組合或特殊商品，請盤點實際組成品項' : !inventoryUnit(product.unit) ? '商品尚未設定庫存單位' : product.inventoryBalances.some(b => b.warehouse.code !== 'WH-MAIN' && b.quantity !== 0) && (!balance || unit !== inventoryUnit(product.unit)) ? '其他倉庫有庫存，需一起核對單位' : !balance ? '尚未建立主倉庫存，需先登記首次實盤數量' : unit !== inventoryUnit(product.unit) ? '主倉與商品單位不一致，需先核對' : undefined,
            canConfirmUnit: !!inventoryUnit(product.unit) && product.status === 'active' && product.productCategory === 'STANDARD'
                && (!balance || unit !== inventoryUnit(product.unit))
                && !product.inventoryBalances.some(b => b.warehouse.code !== 'WH-MAIN' && b.quantity !== 0),
            otherWarehouses: product.inventoryBalances.filter(b => b.warehouse.code !== 'WH-MAIN' && b.quantity !== 0)
                .map(b => ({ name: b.warehouse.name, quantity: b.quantity, unit: inventoryUnit(b.unit) })),
        };
    });
    const canEdit = !!user && COUNT_ROLES.includes(user.role);
    const signatures = new Map<string, typeof pendingOrders>();
    for (const order of pendingOrders) {
      const key = JSON.stringify([order.vendorId, order.warehouseId, String(order.totalAmount), order.items.map(item => [item.productId, item.quantityGrams, String(item.rawAmount)]).sort((a,b) => String(a[0]).localeCompare(String(b[0])))]);
      signatures.set(key, [...(signatures.get(key) ?? []), order]);
    }
    const alerts = [...signatures.values()].filter(group => group.length > 1).map(group => ({ id: group[0].id, title: `${group[0].vendor?.name ?? '未指定廠商'}：${group.length} 筆採購內容相同`, detail: '請核對是否重複下單，勿直接重複入庫' }));
    for (const order of pendingOrders) if (/需沖銷|提前入庫|不得重複入庫/.test(order.note ?? '')) alerts.push({ id: order.id, title: `${order.orderNumber} 備註需核對`, detail: '原單註記入庫異常，收貨前請先核對' });
    return <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
      <InventoryWorkbench rows={rows} canEdit={canEdit} canVerifyUnits={canEdit} initialQuery={query.q} pendingCount={pendingCount} purchaseAlerts={alerts.slice(0,5)} />
    </div>;
}
