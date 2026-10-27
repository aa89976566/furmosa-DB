import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { loadOrderFormOptions } from '@/lib/order-form-options';
import { buildOrderCreateInitial } from '@/lib/orders/build-edit-initial';
import { Button } from '@/components/ui/button';
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
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <Button variant="ghost" asChild><Link href={sourceOrder ? `/orders/${sourceOrder.id}` : '/orders'}>返回</Link></Button>
        <h1 className="text-xl font-semibold sm:text-2xl">{sourceOrder ? '複製訂單' : '新增訂單'}</h1>
        <details className="relative">
          <summary className="flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm">更多</summary>
          <nav aria-label="開單頁更多選項" className="absolute right-0 z-40 grid w-40 gap-1 rounded-lg border bg-card p-2 shadow-lg">
            <Link className="rounded px-3 py-3 text-sm hover:bg-muted" href="/orders">訂單列表</Link>
            <Link className="rounded px-3 py-3 text-sm hover:bg-muted" href="/merchants">店家資料</Link>
            <Link className="rounded px-3 py-3 text-sm hover:bg-muted" href="/dashboard">返回首頁</Link>
          </nav>
        </details>
      </header>
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6">
          {sourceOrder ? (
            <p className="mb-4 text-sm text-muted-foreground">
              已複製 {sourceOrder.items.length} 個品項，共{' '}
              {sourceOrder.items.reduce((sum, item) => sum + item.quantity, 0)} 件商品。
            </p>
          ) : null}
          <OrderForm
            key={sourceOrder?.id ?? 'new'}
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
      </div>
    </>
  );
}
