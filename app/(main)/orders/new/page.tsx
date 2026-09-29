import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { loadOrderFormOptions } from '@/lib/order-form-options';
import { buildOrderCreateInitial } from '@/lib/orders/build-edit-initial';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { OrderForm } from './order-form';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage(props: {
  searchParams?: Promise<{ copyFrom?: string }>;
}) {
  const searchParams = await props.searchParams;
  const copyFrom = searchParams?.copyFrom?.trim();
  const user = await getCurrentUser();
  const sourceOrder = copyFrom
    ? await prisma.order.findUnique({
        where: { id: copyFrom },
        include: {
          items: true,
          shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      })
    : null;
  if (copyFrom && (!sourceOrder || sourceOrder.omsStatus)) notFound();

  const productIds = sourceOrder
    ? [...new Set(sourceOrder.items.map((item) => item.productId))]
    : [];
  const productSkus = sourceOrder
    ? [...new Set(sourceOrder.items.map((item) => item.sku).filter(Boolean))]
    : [];
  const [merchants, customers, products] = await loadOrderFormOptions({
    customerIds: sourceOrder?.customerId ? [sourceOrder.customerId] : [],
    productIds,
    productSkus,
  });
  const initial = sourceOrder
    ? buildOrderCreateInitial(sourceOrder, sourceOrder.shipments[0], products)
    : undefined;

  return (
    <>
      <PageHeader
        title={sourceOrder ? `複製訂單 · ${sourceOrder.orderNumber}` : '新增訂單'}
        description={sourceOrder
          ? '已帶入原訂單資料；可先修改商品、數量、規格與配送，再建立新訂單。'
          : '先選一般客戶或訂購店家；店家訂單會依合作方式顯示適用商品與設定。'}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={sourceOrder ? `/orders/${sourceOrder.id}` : '/orders'}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <SectionCard title="訂單資訊" className="max-w-5xl">
          {sourceOrder ? (
            <p className="mb-4 text-sm text-muted-foreground">
              已複製 {sourceOrder.items.length} 個品項，共{' '}
              {sourceOrder.items.reduce((sum, item) => sum + item.quantity, 0)} 件商品。
            </p>
          ) : null}
          <OrderForm
            merchants={merchants}
            customers={customers}
            products={products}
            initial={initial}
            draftStorageKey={
              user
                ? `furmosa:order-draft:v1:${user.userId}:${copyFrom ?? 'new'}`
                : undefined
            }
          />
          <p className="mt-4 text-[11px] text-muted-foreground">
            訂單編號（ORD-YYYYMM-XXX）會在儲存時自動產生。
          </p>
        </SectionCard>
      </div>
    </>
  );
}
