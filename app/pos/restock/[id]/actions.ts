'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedMerchantId, requireMerchantSession } from '@/lib/merchant-auth';
import { applyMerchantRestockFromShipment } from '@/lib/merchant-restock-inventory';
import { validateRestockReceipt } from '@/lib/pos/restock-receipt';

export async function confirmRestockReceiptAction(formData: FormData): Promise<void> {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const requestId = String(formData.get('requestId') ?? '').trim();
  if (!requestId) throw new Error('缺少補貨申請');

  await prisma.$transaction(async (tx) => {
    const request = await tx.restockRequest.findFirst({
      where: { id: requestId, merchantId },
      select: {
        shipment: {
          select: {
            id: true,
            merchantId: true,
            shipmentNumber: true,
            status: true,
            items: {
              select: {
                id: true,
                productId: true,
                quantity: true,
                weightGrams: true,
              },
            },
          },
        },
      },
    });

    const shipment = request?.shipment;
    if (!shipment || shipment.merchantId !== merchantId) {
      throw new Error('找不到這張補貨出貨單');
    }
    if (shipment.status === 'received') return;
    if (shipment.status !== 'delivered') {
      throw new Error('商品尚未送達，現在不能確認收貨');
    }

    const submittedQuantities = new Map(
      shipment.items.map((item) => [
        item.id,
        Number(formData.get(`received:${item.id}`)),
      ]),
    );
    validateRestockReceipt(
      shipment.items.map((item) => ({
        lineId: item.id,
        expectedQuantity: item.quantity,
      })),
      submittedQuantities,
    );

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
  revalidatePath(`/pos/restock/${requestId}`);
  revalidatePath('/shipments');
  revalidatePath('/restock-requests');
  redirect(`/pos/restock/${requestId}?received=1`);
}
