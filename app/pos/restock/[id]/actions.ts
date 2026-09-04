'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedMerchantId, requireMerchantSession } from '@/lib/merchant-auth';
import { applyMerchantRestockFromShipment } from '@/lib/merchant-restock-inventory';

export async function confirmRestockReceiptAction(formData: FormData): Promise<void> {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const requestId = String(formData.get('requestId') ?? '').trim();
  const shipmentId = String(formData.get('shipmentId') ?? '').trim();
  if (!requestId && !shipmentId) throw new Error('缺少補貨或出貨資料');

  await prisma.$transaction(async (tx) => {
    const shipmentSelect = {
      id: true,
      merchantId: true,
      shipmentNumber: true,
      status: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          weightGrams: true,
        },
      },
    } as const;
    const shipment = shipmentId
      ? await tx.shipment.findFirst({
          where: { id: shipmentId, merchantId, type: 'merchant_restock' },
          select: shipmentSelect,
        })
      : (
          await tx.restockRequest.findFirst({
            where: { id: requestId, merchantId },
            select: { shipment: { select: shipmentSelect } },
          })
        )?.shipment;
    if (!shipment || shipment.merchantId !== merchantId) {
      throw new Error('找不到這張補貨出貨單');
    }
    if (shipment.status === 'received') return;
    if (shipment.status !== 'delivered') {
      throw new Error('商品尚未送達，現在不能確認收貨');
    }

    const updated = await tx.shipment.updateMany({
      where: { id: shipment.id, merchantId, status: 'delivered' },
      data: { status: 'received' },
    });
    if (updated.count !== 1) throw new Error('出貨狀態已變更，請重新整理');

    await applyMerchantRestockFromShipment(
      tx,
      {
        shipmentNumber: shipment.shipmentNumber,
        merchantId,
        items: shipment.items,
      },
      new Date(),
    );
  });

  revalidatePath('/pos');
  revalidatePath('/pos/stock');
  revalidatePath('/pos/restock/progress');
  if (requestId) revalidatePath(`/pos/restock/${requestId}`);
  if (shipmentId) revalidatePath(`/pos/restock/shipment/${shipmentId}`);
  revalidatePath('/shipments');
  revalidatePath('/restock-requests');
  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath(`/merchants/${merchantId}/products`);
  revalidatePath(`/merchants/${merchantId}/shipments`);
  redirect(
    requestId
      ? `/pos/restock/${requestId}?received=1`
      : `/pos/restock/shipment/${shipmentId}?received=1`,
  );
}
