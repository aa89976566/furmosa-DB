import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardCheck, PackageCheck, ShoppingCart, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPurchaseDate } from '@/lib/inventory/purchase-presentation';
import type { DashboardProcurementData } from '@/lib/inventory/load-dashboard-procurement';
import type { ReorderAlertRow } from '@/lib/inventory/reorder-alerts';

const quantity = (value: number, unit: string | null) => `${value.toLocaleString('zh-TW')} ${unit ?? '（單位待核對）'}`;
function purchaseHref(row: ReorderAlertRow) {
  return row.unit === 'g'
    ? `/inventory/purchase-orders/new?${new URLSearchParams({ productId: row.id, quantityGrams: String(row.deficit) })}`
    : `/products/${row.id}`;
}

export function InventoryActionBoard({ data, today }: { data: DashboardProcurementData; today: Date }) {
  const { reorderAlerts, purchases, merchantStocks, merchantStockCount, shipmentAudit } = data;
  const stats = [
    { id: 'purchase-now', label: '立即採購', count: reorderAlerts.orderNow.length, unit: '項商品', icon: ShoppingCart, tone: 'text-destructive' },
    { id: 'purchase-incoming', label: '已訂待到貨', count: purchases.length, unit: '張採購單', icon: PackageCheck, tone: 'text-primary' },
    { id: 'purchase-count', label: '需要盤點', count: reorderAlerts.stocktake.length, unit: '項商品', icon: ClipboardCheck, tone: 'text-warning' },
    { id: 'purchase-merchant', label: '店家待補貨', count: merchantStockCount, unit: '筆店家規格', icon: Store, tone: 'text-primary' },
  ];
  return <section aria-labelledby="procurement-title" className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-semibold tracking-widest text-primary">FURMOSA HQ · 庫存待辦</p><h2 id="procurement-title" className="mt-1 text-2xl font-semibold tracking-tight text-navy">今天要採購什麼</h2><p className="mt-1 text-sm text-muted-foreground">先處理缺貨，再確認到貨與店家補貨。</p></div>
      <Button variant="outline" asChild><Link href="/inventory">全部庫存<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
    </div>
    <nav aria-label="庫存待辦分類" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ id, label, count, unit, icon: Icon, tone }) => <a key={id} href={`#${id}`} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <div className={`flex items-center justify-between gap-2 text-sm font-medium ${tone}`}><span>{label}</span><Icon className="h-4 w-4" /></div>
        <p className="mt-3 text-3xl font-semibold tabular-nums text-navy">{count}<span className="ml-2 text-xs font-normal text-muted-foreground">{unit}</span></p>
      </a>)}
    </nav>

    <BoardSection id="purchase-now" title="立即採購" count={reorderAlerts.orderNow.length} description="缺口＝補貨點－主倉現存－主倉待到貨；這是補到安全線的參考量。">
      <ExpandableRows empty="目前沒有需要立即採購的商品。" rows={reorderAlerts.orderNow.map(row => <div key={row.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${row.onHand === 0 ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>{row.onHand === 0 ? '缺貨' : '低庫存'}</span><Link href={`/products/${row.id}`} className="font-semibold hover:underline">{row.name}</Link></div>
          <p className="mt-2 text-xs text-muted-foreground">{row.sku} · {row.vendorName ?? '供應商待設定'}</p>
          <p className="mt-1 text-sm text-muted-foreground">現存 {quantity(row.onHand, row.unit)} · 補貨點 {quantity(row.reorderPoint, row.unit)}{row.incoming > 0 ? ` · 待到貨 ${quantity(row.incoming, row.unit)}` : ''}</p></div>
        <div><p className="text-xs text-muted-foreground">{row.deficit > 0 ? '補到安全線尚缺' : '已到補貨點'}</p><p className="mt-1 text-lg font-semibold tabular-nums text-destructive">{row.deficit > 0 ? quantity(row.deficit, row.unit) : '請評估採購量'}</p></div>
        <Button variant="outline" className="min-h-11" asChild><Link href={purchaseHref(row)}>{row.unit === 'g' ? '建立採購單' : '查看商品設定'}</Link></Button>
      </div>)} />
    </BoardSection>

    <div className="grid gap-4 xl:grid-cols-2">
      <BoardSection id="purchase-incoming" title="已訂待到貨" count={purchases.length} description="只顯示尚未實收數量；提醒日為催貨起日，並非承諾到貨日。">
        <ExpandableRows empty="目前沒有待到貨採購單。" rows={purchases.map(order => <Link key={order.id} href={`/inventory/purchase-orders/${order.id}`} className="block py-4 hover:bg-muted/25">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{order.vendor?.name ?? '供應商待設定'}</span><span className={`rounded-full px-2 py-1 text-xs ${order.remindFromDate < today ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>{order.remindFromDate < today ? '已過提醒日' : '提醒日'} {formatPurchaseDate(order.remindFromDate)}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">{order.orderNumber} · {order.warehouse.name}</p>
          <p className="mt-2 text-sm">{order.remainingLines.length ? order.remainingLines.map(line => `${line.productName} ${quantity(line.remaining, line.unit)}`).join('、') : '品項已收齊，請核對結案狀態'}</p>
          <p className="mt-2 text-sm font-medium text-primary">查看並驗收入庫 →</p>
        </Link>)} />
      </BoardSection>
      <BoardSection id="purchase-count" title="需要盤點" count={reorderAlerts.stocktake.length} description="負庫存、尚未盤點或單位不明，先核對再決定採購量。">
        <ExpandableRows empty="目前沒有需要優先盤點的商品。" rows={reorderAlerts.stocktake.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div><p className="font-semibold">{row.name}</p><p className="mt-1 text-xs text-muted-foreground">{row.sku}</p><p className="mt-2 text-sm text-warning">{!row.unit || row.unitVerified === false ? '庫存單位待核對' : row.onHand < 0 ? `負庫存 ${quantity(row.onHand, row.unit)}` : '尚未完成盤點'}</p></div>
          <Button variant="outline" className="min-h-11" asChild><Link href={`/inventory?q=${encodeURIComponent(row.sku)}`}>核對庫存</Link></Button>
        </div>)} />
      </BoardSection>
    </div>

    <BoardSection id="purchase-merchant" title="店家待補貨" count={merchantStockCount} description={`沿用 POS 提醒門檻：每個店家規格剩 ${data.merchantLowThreshold} 件以下；不同規格分開顯示。`}>
      <ExpandableRows empty="目前沒有店家規格低於提醒門檻。" rows={merchantStocks.map(stock => {
        const tier = stock.product.priceTiers.find(tier => tier.id === stock.tierId);
        const tierLabel = tier ? tier.weightGrams ? `${tier.weightGrams}g` : `${tier.unitQty}${tier.unit}` : '舊規格待核對';
        const verify = !tier || stock.quantity < 0;
        return <div key={stock.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
          <div><p className="font-semibold">{stock.merchant.name}</p><p className="mt-1 text-sm text-muted-foreground">{stock.product.name} · {tierLabel}</p></div>
          <p className={`font-semibold tabular-nums ${verify ? 'text-warning' : stock.quantity === 0 ? 'text-destructive' : 'text-navy'}`}>{stock.quantity} 件{verify ? ' · 需核對' : ''}</p>
          <Button variant="outline" className="min-h-11" asChild><Link href={verify ? `/inventory?q=${encodeURIComponent(stock.merchant.name)}` : `/merchants/restock?merchantId=${encodeURIComponent(stock.merchantId)}`}>{verify ? '核對店家庫存' : '建立補貨單'}</Link></Button>
        </div>;
      })} />
      {merchantStockCount > merchantStocks.length ? <p className="border-t py-3 text-sm text-muted-foreground">列出最急迫的 {merchantStocks.length} 筆，共 {merchantStockCount} 筆。<Link href="/inventory" className="ml-2 font-medium text-primary underline">查看全通路庫存</Link></p> : null}
    </BoardSection>

    <BoardSection id="shipment-stock-check" title="出貨扣庫存檢查" count={shipmentAudit.missing.length} description={`近 ${shipmentAudit.days} 天已出貨的納管出貨單，最多檢查最新 ${shipmentAudit.limit} 筆；本次 ${shipmentAudit.checked} 筆。`}>
      <ExpandableRows empty={shipmentAudit.checked ? '本次檢查未發現缺少商品扣庫存紀錄；數量差異仍需對帳。' : '此範圍內尚無可檢查的納管出貨單。'} rows={shipmentAudit.missing.map(shipment => <Link key={shipment.id} href={`/shipments/${shipment.id}`} className="block py-4 hover:bg-muted/25"><p className="font-semibold text-destructive">{shipment.shipmentNumber} · 扣庫存紀錄待核對</p><p className="mt-1 text-sm text-muted-foreground">{shipment.missing.join('、')}</p><p className="mt-2 text-sm font-medium text-primary">查看出貨單 →</p></Link>)} />
      <p className="border-t py-3 text-xs leading-relaxed text-muted-foreground">原味雞霸 FUR-0002 為接單現做，不扣主倉現貨。歷史未納管出貨及已退款／退貨訂單排除；此處僅提示，不會自動補扣庫存。</p>
    </BoardSection>
  </section>;
}

function BoardSection({ id, title, count, description, children }: { id: string; title: string; count: number; description: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 overflow-hidden rounded-2xl border bg-card">
    <div className="border-b bg-muted/15 px-4 py-4 sm:px-5"><div className="flex items-center gap-2"><h3 id={`${id}-title`} className="font-semibold text-navy">{title}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{count}</span></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div>
    <div className="px-4 sm:px-5">{children}</div>
  </section>;
}

function ExpandableRows({ rows, empty }: { rows: ReactNode[]; empty: string }) {
  return rows.length ? <><div className="divide-y">{rows.slice(0, 6)}</div>{rows.length > 6 ? <details className="border-t"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-primary">展開其餘 {rows.length - 6} 筆</summary><div className="divide-y">{rows.slice(6)}</div></details> : null}</> : <p className="py-6 text-sm text-muted-foreground">{empty}</p>;
}
