import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ProductForm } from '../[id]/product-form';
import { createProduct } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewProductPage(
  props: {
    searchParams?: Promise<{ vendorId?: string; fromCandidate?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const preselectedVendorId = searchParams?.vendorId ?? null;
  const candidate = searchParams?.fromCandidate
    ? await prisma.shopifyCatalogCandidate.findUnique({
        where: { id: searchParams.fromCandidate },
        select: { id: true, productTitle: true, variantTitle: true, price: true, resolution: true },
      })
    : null;
  const candidatePrefill = candidate?.resolution === 'pending' ? candidate : null;

  const vendors = await prisma.vendor.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, vendorId: true },
  });

  return (
    <>
      <PageHeader
        title="新增商品"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={candidatePrefill ? `/products/shopify-candidates/${candidatePrefill.id}` : '/products'}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {candidatePrefill ? '返回候選商品' : '返回列表'}
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        {candidatePrefill ? (
          <div className="mb-5 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-semibold">從 Shopify 候選建立（第 1 步／共 2 步）</p>
            <p className="mt-1">
              Shopify 規格「{candidatePrefill.variantTitle || '預設規格'}」售價為 NT${Number(candidatePrefill.price).toLocaleString('zh-TW')}，僅供參考。
              請依實際資料建立商品；系統不會推定重量、單位、成本或庫存。
            </p>
            <p className="mt-1">建立後請回候選商品頁，使用「連結現有商品規格」完成第 2 步。</p>
          </div>
        ) : candidate ? (
          <div className="mb-5 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            這筆 Shopify 候選已處理完成，因此不再帶入預填資料。
          </div>
        ) : null}
        <SectionCard
          title="商品主檔"
          description="步驟 1：建立商品基本資料與合作方式；步驟 2：建立後設定各規格售價與買斷進貨價。"
          className="max-w-3xl"
        >
          <ProductForm
            productType="variable"
            product={{
              name: candidatePrefill?.productTitle ?? '',
              category: 'other',
              style: null,
              unit: '件',
              price: 0,
              cost: 0,
              reorderPoint: 10,
              status: 'active',
              vendorId: preselectedVendorId,
              notes: null,
              defaultTemperature: null,
              productCategory: 'STANDARD',
              businessTier: 'standard',
              defaultConsignmentCommissionMode: null,
              defaultConsignmentCommissionValue: null,
              defaultWholesaleUnitPrice: null,
              consignmentEnabled: false,
              wholesaleEnabled: false,
              jarExchangeEnabled: false,
              commercialTermsVersion: null,
            }}
            vendors={vendors}
            variationCount={0}
            saveAction={createProduct}
            submitLabel="建立商品"
          />
          <p className="mt-4 text-xs text-muted-foreground">
            商品編號與 SKU 會自動產生。商品建立後，系統會帶你到商品頁完成重量／包裝規格、售價及買斷進貨價。
          </p>
        </SectionCard>
      </div>
    </>
  );
}
