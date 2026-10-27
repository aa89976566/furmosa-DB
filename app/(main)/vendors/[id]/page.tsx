import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { ArrowLeft, ReceiptText } from 'lucide-react';
import { VendorForm } from './vendor-form';
import { VendorProductsSection } from '@/components/vendors/vendor-products-section';
import { updateVendor, deleteVendor } from '../actions';
import { VendorSettlementSection } from '@/components/vendors/vendor-settlement-section';
import { currentTaipeiMonth } from '@/lib/vendor-settlement-period';

export const dynamic = 'force-dynamic';

export default async function VendorDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    include: {
      products: { orderBy: { productId: 'asc' } },
      vendorSettlements: {
        orderBy: { periodStart: 'desc' },
        take: 12,
        include: { _count: { select: { items: true } } },
      },
    },
  });
  if (!vendor) notFound();

  const [linkableProducts] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [{ vendorId: null }, { vendorId: { not: vendor.id } }],
      },
      orderBy: { productId: 'asc' },
      select: {
        id: true,
        productId: true,
        name: true,
        vendor: { select: { name: true } },
      },
      take: 200,
    }),
  ]);

  const productRows = vendor.products.map((p) => ({
    id: p.id,
    productId: p.productId,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    cost: Number(p.cost),
  }));

  return (
    <>
      <PageHeader
        title={vendor.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{vendor.vendorId}</span>
            <span>·</span>
            <span>{vendor.products.length} 個商品</span>
            <Badge variant={vendor.status === 'active' ? 'success' : 'muted'}>
              {vendor.status === 'active' ? '啟用' : '停用'}
            </Badge>
          </span>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/vendors">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <SectionCard title="基本資料" className="lg:col-span-1">
          <VendorForm
            vendor={{
              id: vendor.id,
              vendorId: vendor.vendorId,
              name: vendor.name,
              contactName: vendor.contactName,
              phone: vendor.phone,
              email: vendor.email,
              address: vendor.address,
              paymentTerms: vendor.paymentTerms,
              notes: vendor.notes,
              status: vendor.status,
              supplierConsignmentEnabled: vendor.supplierConsignmentEnabled,
              furmosaShareBps: vendor.furmosaShareBps,
            }}
            saveAction={updateVendor}
            deleteAction={deleteVendor}
          />
          <p className="mt-4 text-[11px] text-muted-foreground">
            建立於 {formatDateTime(vendor.createdAt)}
          </p>
        </SectionCard>

        <SectionCard
          title="廠商商品"
          description="新增或連結的商品會同步顯示於「產品」列表"
          className="lg:col-span-2"
          contentClassName="pt-6"
        >
          <VendorProductsSection
            vendorId={vendor.id}
            products={productRows}
            linkableProducts={linkableProducts.map((p) => ({
              id: p.id,
              productId: p.productId,
              name: p.name,
              vendorName: p.vendor?.name ?? null,
            }))}
          />
        </SectionCard>

        {vendor.supplierConsignmentEnabled && vendor.furmosaShareBps != null ? (
          <SectionCard
            title="供應商對帳"
            description="依已付款訂單、實際折扣與訂單建立時保存的分潤比例計算"
            icon={ReceiptText}
            tone="operations"
            className="lg:col-span-3"
            contentClassName="pt-6"
          >
            <VendorSettlementSection
              vendorId={vendor.id}
              furmosaShareBps={vendor.furmosaShareBps}
              currentMonth={currentTaipeiMonth()}
              settlements={vendor.vendorSettlements.map((settlement) => ({
                id: settlement.id,
                settlementNumber: settlement.settlementNumber,
                periodStart: settlement.periodStart.toISOString(),
                periodEnd: settlement.periodEnd.toISOString(),
                grossCollectedTwd: settlement.grossCollectedTwd - settlement.refundTwd,
                furmosaShareTwd: settlement.furmosaShareTwd,
                vendorPayableTwd: settlement.vendorPayableTwd,
                status: settlement.status,
                itemCount: settlement._count.items,
              }))}
            />
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
