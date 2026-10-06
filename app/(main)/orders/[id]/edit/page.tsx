import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { loadOrderFormOptions } from '@/lib/order-form-options';
import { buildOrderEditInitial, isOrderEditable } from '@/lib/orders/build-edit-initial';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { shippingFeeTypeLabel } from '@/lib/labels';
import { shippingMethodLabel } from '@/lib/shipping-policy';
import { ArrowLeft } from 'lucide-react';
import { OrderForm } from '../../new/order-form';
import { safeOrderEditReturnTo } from '@/lib/orders/order-edit-return';

export const dynamic = 'force-dynamic';

export default async function EditOrderPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const returnTo = safeOrderEditReturnTo(searchParams?.returnTo);
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      shipments: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!order) notFound();

  const editable = isOrderEditable(order);
  if (!editable.ok) {
    return (
      <>
        <PageHeader
          tone="orders"
          title={`修改訂單 · ${order.orderNumber}`}
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href={returnTo ?? `/orders/${order.id}`}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                返回詳情
              </Link>
            </Button>
          }
        />
        <div className="p-6">
          <SectionCard title="此訂單為唯讀" className="max-w-2xl">
            <p className="text-sm text-muted-foreground">{editable.reason}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {order.items.length > 0 ? order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 border-b pb-2">
                  <span className="min-w-0 truncate">{item.productName}</span>
                  <span className="shrink-0 tabular-nums">數量 {item.quantity}</span>
                </li>
              )) : (
                <li className="text-muted-foreground">沒有商品明細</li>
              )}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              配送：{shippingMethodLabel({
                shippingMethod: order.shippingMethod,
                cvsBrand: order.cvsBrand,
              })}
              {' · '}
              {shippingFeeTypeLabel[order.shippingFeeType] ?? order.shippingFeeType}
              {' · '}
              運費 {formatCurrency(Number(order.shippingFee))}
            </p>
          </SectionCard>
        </div>
      </>
    );
  }

  const productIds = [...new Set(order.items.map((item) => item.productId))];
  const [merchants, customers, products] = await loadOrderFormOptions({
    customerIds: order.customerId ? [order.customerId] : [],
    productIds,
  });
  const edit = buildOrderEditInitial(order, order.shipments[0], products);

  return (
    <>
      <PageHeader
        tone="orders"
        title={`修改訂單 · ${order.orderNumber}`}
        description="可調整客戶、品項、運送、備註與金額；儲存後同步出貨單"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={returnTo ?? `/orders/${order.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回詳情
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <SectionCard title="訂單資訊" className="max-w-5xl">
          <OrderForm
            merchants={merchants}
            customers={customers}
            products={products}
            edit={edit}
            returnTo={returnTo ?? undefined}
          />
        </SectionCard>
      </div>
    </>
  );
}
