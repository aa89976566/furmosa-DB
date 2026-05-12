import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ProductForm } from '../[id]/product-form';
import { createProduct } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
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
        <SectionCard title="商品資訊" className="max-w-2xl">
          <ProductForm
            product={{
              name: '',
              category: 'other',
              style: null,
              unit: '件',
              price: 0,
              cost: 0,
              reorderPoint: 10,
              status: 'active',
              vendorId: null,
              notes: null,
            }}
            vendors={vendors}
            saveAction={createProduct}
            submitLabel="建立商品"
          />
          <p className="mt-4 text-[11px] text-muted-foreground">
            商品編號（PROD-XXXX）與 SKU（FUR-XXXX）會在儲存時自動產生。
          </p>
        </SectionCard>
      </div>
    </>
  );
}
