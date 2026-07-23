import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { loadOrderFormOptions } from '@/lib/order-form-options';
import { buildOrderEditInitial, isOrderEditable } from '@/lib/orders/build-edit-initial';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { OrderForm } from '../../new/order-form';

export const dynamic = 'force-dynamic';

export default async function EditOrderPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      shipments: { orderBy: { createdAt: 'asc' }, take: 1 },
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
              <Link href={`/orders/${order.id}`}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                返回詳情
              </Link>
            </Button>
          }
        />
        <div className="p-6">
          <SectionCard title="無法修改" className="max-w-2xl">
            <p className="text-sm text-muted-foreground">{editable.reason}</p>
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
            <Link href={`/orders/${order.id}`}>
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
          />
        </SectionCard>
      </div>
    </>
  );
}
