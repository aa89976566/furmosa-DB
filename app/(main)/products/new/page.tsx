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
    searchParams?: Promise<{ vendorId?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const preselectedVendorId = searchParams?.vendorId ?? null;

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
            <Link href="/products">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <SectionCard
          title="商品主檔"
          description="步驟 1：建立商品基本資料與合作方式；步驟 2：建立後設定各規格售價與買斷進貨價。"
          className="max-w-3xl"
        >
          <ProductForm
            productType="variable"
            product={{
              name: '',
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
