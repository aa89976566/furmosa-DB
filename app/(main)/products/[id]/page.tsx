import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
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
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import { Boxes, Layers, Truck, ShoppingCart, PackageCheck, Plus } from 'lucide-react';
import { ProductCover } from '@/components/pos/product-cover';
import { bulkUnit } from '@/lib/inventory/bulk';
import { outstandingPurchaseLines } from '@/lib/inventory/dashboard-procurement';
import { formatPurchaseDate, formatPurchaseMoney } from '@/lib/inventory/purchase-presentation';
import { computeTierMargin, tierCostDisplay } from '@/lib/product-price-tier';
import { productMainStock, formatUnitCost } from '@/lib/products/operations';
import './product-workbench.css';
import { ProductForm } from './product-form';
import { updateProduct, deleteProduct } from '../actions';
import { PriceTierManager } from './price-tier-manager';
import { VendorInfoCard } from '@/components/vendors/vendor-info-card';
import { canonicalTierSku } from '@/lib/products/canonical-sku';
import { summarizeVariations } from '@/lib/product-variations';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const params = await props.params;
  const [product, vendors] = await Promise.all([
    prisma.product.findUnique({
      where: { id: params.id },
      include: {
        vendor: true,
        priceTiers: {
          orderBy: [{ weightGrams: 'asc' }, { unitQty: 'asc' }],
        },
        inventoryBalances: { include: { warehouse: true } },
        inventoryTransactions: {
          include: { warehouse: true },
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
    }),
    prisma.vendor.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, vendorId: true },
    }),
  ]);
  if (!product) notFound();

  const receiptSelect = { id: true, purchaseOrderId: true, items: { select: { productId: true, quantityGrams: true, sourceOrderItemId: true } } } as const;
  const [receipts, pending] = await Promise.all([
    prisma.purchaseReceiptItem.findMany({ where: { productId: product.id, purchaseReceipt: { status: 'posted' } }, include: { purchaseReceipt: { include: { vendor: true, warehouse: true } } }, orderBy: [{ purchaseReceipt: { receiptDate: { sort: 'desc', nulls: 'last' } } }, { createdAt: 'desc' }], take: 20 }),
    prisma.purchaseOrder.findMany({ where: { status: 'pending_receipt', items: { some: { productId: product.id } } }, include: { vendor: true, warehouse: true, items: true, receipt: { select: receiptSelect }, receipts: { select: receiptSelect } }, orderBy: [{ remindFromDate: 'asc' }, { id: 'asc' }] }),
  ]);
  const variations = product.priceTiers.map((tier) => ({
    id: tier.id,
    weightGrams: tier.weightGrams,
    unit: tier.unit,
    unitQty: tier.unitQty,
    price: tier.price,
    cost: tier.cost,
    defaultWholesaleUnitPrice: tier.defaultWholesaleUnitPrice,
    status: tier.status,
    sku: tier.sku,
    shopifySku: tier.shopifySku,
    shopifyVariantId: tier.shopifyVariantId,
    notes: tier.notes,
  }));
  const variationSummary = summarizeVariations(variations);

  const statusLabel =
    product.status === 'active' ? '上架' : product.status === 'draft' ? '草稿' : '下架';

  const query = await props.searchParams;
  const tab = ['pricing', 'supply', 'history', 'info'].includes(query.tab ?? '') ? query.tab! : 'overview';
  const href = (value: string) => `/products/${product.id}?tab=${value}`;
  const balance = product.inventoryBalances.find(row => row.warehouse.code === 'WH-MAIN');
  const stock = productMainStock(balance, product.unit);
  const purchaseHref = `/inventory/purchase-orders/new?productId=${product.id}`;
  const stocktakeHref = `/inventory/stocktake/${product.id}`;
  const latest = receipts.find(row => row.purchaseReceipt.receiptDate !== null);
  const incoming = pending.flatMap(order => outstandingPurchaseLines(order).filter(line => line.productId === product.id).map(line => ({ order, line })));
  const mainIncoming = incoming.filter(row => row.order.warehouse.code === 'WH-MAIN' && row.line.unit === 'g').reduce((sum, row) => sum + row.line.remaining, 0);
  const supplierPanel = <section className="product-panel" aria-labelledby="supplier-title">
    <h2 id="supplier-title"><Truck size={19} />廠商與補貨</h2>
    <p className="product-muted">主要廠商</p>
    <div className="product-supplier-name"><strong>{product.vendor?.name ?? '尚未指定廠商'}</strong>{product.vendor && <Link href={`/vendors/${product.vendor.id}`}>查看廠商 →</Link>}</div>
    <p className="product-muted">{[product.vendor?.contactName, product.vendor?.phone].filter(Boolean).join(' · ') || '尚無聯絡資料'}</p>
    <dl className="product-facts">
      <MetaItem label="付款條件" value={product.vendor?.paymentTerms ?? '尚未登錄'} />
      <MetaItem label="補貨點" value={`${formatNumber(product.reorderPoint)} ${bulkUnit(product.unit) ?? '單位待確認'}`} />
      <MetaItem label="最近實際進貨" value={latest ? `${formatPurchaseDate(latest.purchaseReceipt.receiptDate)} · ${formatNumber(latest.quantityGrams)}g` : '尚無已填日期紀錄'} />
      <MetaItem label="最近入庫成本" value={latest ? `${formatUnitCost(latest.costPerGram.toString())}/g` : '尚無紀錄'} />
    </dl>
    <p className="product-muted">最近成本含分攤費用，屬散裝每克成本。</p>
    <Button asChild className="w-full"><Link href={purchaseHref}><Plus size={16} className="mr-2" />建立採購單</Link></Button>
  </section>;
  const incomingPanel = <section className="product-panel" aria-labelledby="incoming-title">
    <h2 id="incoming-title"><ShoppingCart size={19} />採購中／待到貨</h2>
    {!incoming.length && <p className="product-empty">目前沒有待收貨採購。</p>}
    {incoming.map(({ order, line }) => <div className="product-incoming" key={line.id}>
      <div className="product-supplier-name"><Link href={`/inventory/purchase-orders/${order.id}`}>{order.orderNumber} →</Link><Badge variant="warning">{line.remaining < line.quantityGrams ? '部分到貨' : '待收貨'}</Badge></div>
      <p className="product-muted">{order.vendor?.name ?? '廠商待補'} · {order.warehouse.name}</p>
      <dl className="product-facts"><MetaItem label="已訂" value={`${formatNumber(line.quantityGrams)} ${line.unit}`} /><MetaItem label="已收" value={`${formatNumber(line.quantityGrams-line.remaining)} ${line.unit}`} /><MetaItem label="未到貨" value={`${formatNumber(line.remaining)} ${line.unit}`} /><MetaItem label="開始提醒日" value={formatPurchaseDate(order.remindFromDate)} /></dl>
    </div>)}
    <p className="product-muted">提醒日供追蹤採購使用，實際到貨時間請向廠商確認。</p>
  </section>;
  const receiptPanel = <section className="product-panel product-receipts" aria-labelledby="receipts-title">
    <h2 id="receipts-title"><PackageCheck size={19} />最近進貨紀錄 <span className="product-muted">最新 20 筆</span></h2>
    <Table><TableHeader><TableRow><TableHead>實收日期</TableHead><TableHead>入庫單／廠商</TableHead><TableHead>倉庫</TableHead><TableHead className="text-right">實收量</TableHead><TableHead className="text-right">入庫成本／g</TableHead><TableHead>狀態</TableHead></TableRow></TableHeader><TableBody>
      {receipts.map(row => <TableRow key={row.id}><TableCell>{formatPurchaseDate(row.purchaseReceipt.receiptDate)}</TableCell><TableCell><Link href={`/inventory/purchases/${row.purchaseReceipt.id}`}>{row.purchaseReceipt.receiptNumber} →</Link><p className="product-muted">{row.purchaseReceipt.vendor?.name ?? '廠商待補'}</p></TableCell><TableCell>{row.purchaseReceipt.warehouse.name}</TableCell><TableCell className="text-right">{formatNumber(row.quantityGrams)}g</TableCell><TableCell className="text-right">{formatUnitCost(row.costPerGram.toString())}</TableCell><TableCell><Badge variant="success">已入庫</Badge></TableCell></TableRow>)}
    </TableBody></Table>
    {!receipts.length && <p className="product-empty">尚無此商品的實收入庫紀錄。</p>}
    <p className="product-muted">實收才增加庫存；成本含分攤費用。缺少日期的紀錄不作為最近進貨依據。</p>
  </section>;
  const skuPanel = <section className="product-panel"><details><summary>SKU 與通路對應</summary><div className="product-sku-list">{variations.map(tier => <div key={tier.id}><strong>{tier.weightGrams ? `${tier.weightGrams}g` : `${tier.unitQty} ${tier.unit}`}</strong><p>HQ SKU：{canonicalTierSku(product.sourceSku, tier, variations.filter(row => row.status === 'active').length) ?? tier.sku ?? '尚未設定'}</p><p>舊 HQ SKU：{tier.sku ?? '尚未設定'}</p><p>Shopify SKU：{tier.shopifySku ?? '尚未設定'}</p><p>Variant ID：{tier.shopifyVariantId ?? '尚未設定'}</p></div>)}</div></details></section>;
  return <div className="product-workbench">
    <nav className="product-breadcrumb"><Link href="/products">← 商品列表</Link><span>商品詳情</span></nav>
    <header className="product-hero">
      <div className="product-identity"><ProductCover name={product.name} imageUrl={product.imageUrl} imgClassName="product-cover" markClassName="product-cover product-cover-fallback" /><div><h1>{product.name}</h1><p className="product-muted">{product.sourceSku ?? product.sku} · {product.sku}</p><Badge variant={product.status === 'active' ? 'success' : 'muted'}>{statusLabel}</Badge></div><Button asChild className="product-edit"><Link href={`${href('info')}#product-master`}>編輯商品</Link></Button></div>
      {(stock.negative || !stock.verified) && <div role="status" className={`product-stock-alert ${stock.negative ? 'negative' : ''}`}><strong>{stock.negative ? `主倉負庫存 ${stock.label}，需核對` : '主倉庫存待核對'}</strong><div><Link href={href('history')}>查看異動</Link><Link href={stocktakeHref}>前往盤點 →</Link></div></div>}
      <div className="product-metrics"><SummaryMetric label="主倉現存" value={stock.label} /><SummaryMetric label="規格數" value={formatNumber(variationSummary.count)} /><SummaryMetric label="售價" value={variationSummary.priceRange} /><SummaryMetric label="主倉採購中" value={bulkUnit(product.unit) === 'g' ? `${formatNumber(mainIncoming)}g` : '依採購明細'} /></div>
    </header>
    <nav className="product-tabs" aria-label="商品資料分頁">{[['overview','總覽'],['pricing','規格與定價'],['supply','廠商與採購'],['history','進貨與庫存紀錄'],['info','通路與商品資料']].map(([value,label]) => <Link key={value} aria-current={tab === value ? 'page' : undefined} href={href(value)}>{label}</Link>)}</nav>
    {tab === 'overview' && <div className="product-columns"><div className="product-primary"><section id="product-variants" className="product-panel"><h2><Layers size={19} />規格與售價<Link className="ml-auto text-sm" href={`${href('pricing')}#product-variants`}>管理規格 →</Link></h2><div className="product-tier-list"><div className="product-tier-heading"><span>規格</span><span>售價</span><span>成本</span><span>預估毛利</span><span>操作</span></div>{variations.map(tier => <div className="product-tier" key={tier.id}><strong>{tier.weightGrams ? `${tier.weightGrams}g` : `${tier.unitQty} ${tier.unit}`}</strong><span><small>售價</small>{formatCurrency(tier.price)}</span><span><small>成本</small>{tierCostDisplay(tier) == null ? '待核對' : formatPurchaseMoney(tierCostDisplay(tier)!)}</span><span><small>預估毛利</small>{computeTierMargin(tier) == null ? '—' : formatPurchaseMoney(computeTierMargin(tier)!)}</span><Link href={`${href('pricing')}#product-variants`} aria-label={`編輯 ${tier.weightGrams ? `${tier.weightGrams}g` : `${tier.unitQty} ${tier.unit}`}`}>編輯</Link></div>)}</div>{!variations.length && <p className="product-empty">尚無規格，請前往管理規格新增。</p>}<p className="product-muted">依規格已登錄成本估算，未含未登錄費用。</p></section>{receiptPanel}{skuPanel}</div><aside className="product-supply">{supplierPanel}{incomingPanel}<p className="product-stock-note">{bulkUnit(product.unit) === 'g' ? '散裝庫存以克數管理，包裝規格共用主倉庫存。' : '各倉庫庫存依實際單位分別記錄。'}</p></aside></div>}
    {tab === 'pricing' && <div className="product-legacy">        <div
          id="product-variants"
          className="scroll-mt-28 rounded-2xl target:ring-4 target:ring-foreground/10"
        >
          <SectionCard
            title="商品規格"
            description="依重量（30g / 50g / 100g…）設定各規格的售價與成本"
            icon={Layers}
            contentClassName="pt-6"
          >
            <PriceTierManager
              productId={product.id}
              productUnit={product.unit}
              productSourceSku={product.sourceSku}
              tiers={variations}
            />
          </SectionCard>
        </div>

</div>}
    {tab === 'info' && <div id="product-master" className="product-legacy">{skuPanel}        <SectionCard
          title="商品主檔"
          description="共用名稱、分類、廠商與補貨設定；售價請在上方規格維護"
          contentClassName="pt-6"
        >
          <ProductForm
            key={`${product.id}:${product.commercialTermsVersion ?? 0}`}
            layout="studio"
            productType="variable"
            product={{
              id: product.id,
              productId: product.productId,
              sku: product.sku,
              name: product.name,
              category: product.category,
              style: product.style,
              unit: product.unit,
              price: Number(product.price),
              cost: Number(product.cost),
              reorderPoint: product.reorderPoint,
              status: product.status,
              vendorId: product.vendorId,
              notes: product.notes,
              defaultTemperature: product.defaultTemperature,
              productCategory: product.productCategory,
              businessTier: product.businessTier,
              defaultConsignmentCommissionMode: product.defaultConsignmentCommissionMode,
              defaultConsignmentCommissionValue: product.defaultConsignmentCommissionValue,
              defaultWholesaleUnitPrice: product.defaultWholesaleUnitPrice,
              consignmentEnabled: product.consignmentEnabled,
              wholesaleEnabled: product.wholesaleEnabled,
              jarExchangeEnabled: product.jarExchangeEnabled,
              commercialTermsVersion: product.commercialTermsVersion,
            }}
            vendors={vendors}
            variationCount={product.priceTiers.length}
            saveAction={updateProduct}
            deleteAction={deleteProduct}
          />
          <dl className="mt-6 grid gap-3 border-t pt-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {product.sourceSku && (
              <MetaItem
                label="商品家族 SKU"
                value={<span className="font-mono text-xs">{product.sourceSku}</span>}
              />
            )}
            <MetaItem label="建立時間" value={formatDateTime(product.createdAt)} />
            <MetaItem label="補貨點" value={formatNumber(product.reorderPoint)} />
            <MetaItem label="列表參考售價" value={formatCurrency(Number(product.price))} />
          </dl>
        </SectionCard>

</div>}
    {tab === 'supply' && <div className="product-columns"><div className="product-primary">{supplierPanel}        <SectionCard
          title="供應與庫存"
          description="廠商來源與各倉庫現有數量"
          contentClassName="space-y-6 pt-6"
        >
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              廠商
            </p>
            {product.vendor ? (
              <VendorInfoCard
                vendor={{
                  id: product.vendor.id,
                  vendorId: product.vendor.vendorId,
                  name: product.vendor.name,
                  contactName: product.vendor.contactName,
                  phone: product.vendor.phone,
                  email: product.vendor.email,
                  address: product.vendor.address,
                  paymentTerms: product.vendor.paymentTerms,
                  notes: product.vendor.notes,
                  status: product.vendor.status,
                }}
              />
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                尚未指定廠商
              </p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              各倉庫庫存
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>倉庫</TableHead>
                  <TableHead>代碼</TableHead>
                  <TableHead className="text-right">數量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.inventoryBalances.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.warehouse.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {b.warehouse.code}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(b.quantity)} {b.unit ?? "（舊數字）"}<div className="text-xs text-muted-foreground">最近盤點：{b.lastCountedAt ? b.lastCountedAt.toISOString().slice(0, 10) : "尚未盤點"}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

</div><aside className="product-supply">{incomingPanel}</aside></div>}
    {tab === 'history' && <div className="product-legacy">{receiptPanel}        <SectionCard
          title="近期庫存異動"
          description="最新 12 筆"
          icon={Boxes}
          contentClassName="pt-6"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>異動單號</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>倉庫</TableHead>
                <TableHead className="text-right">數量</TableHead>
                <TableHead>關聯</TableHead>
                <TableHead>時間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.inventoryTransactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.txnNumber}</TableCell>
                  <TableCell>
                    <StatusBadge kind="inventory" value={t.type} />
                  </TableCell>
                  <TableCell className="text-sm">{t.warehouse.name}</TableCell>
                  <TableCell className="text-right">{formatNumber(t.quantity)} {t.unit ?? "（舊紀錄）"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.reference ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(t.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
</div>}
    <footer className="product-mobile-actions"><Button variant="outline" asChild><Link href={stocktakeHref}>核對庫存</Link></Button><Button asChild><Link href={purchaseHref}>建立採購單</Link></Button></footer>
  </div>;
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="product-muted">{label}</p><strong>{value}</strong></div>;
}
function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="product-muted">{label}</dt><dd>{value}</dd></div>;
}
