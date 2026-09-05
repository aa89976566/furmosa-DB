'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireMerchantSession } from '@/lib/merchant-auth';
import {
  applyMerchantRestockFromShipment,
  validateRestockReceiptShipment,
} from '@/lib/merchant-restock-inventory';

export async function confirmRestockReceiptAction(formData: FormData): Promise<void> {
  const session = await requireMerchantSession();
  const { merchantId, merchantUserId } = session;
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
            type: true,
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
    if (!shipment) {
      throw new Error('找不到這張補貨出貨單');
    }
    if (validateRestockReceiptShipment(shipment, merchantId) === 'already_received') return;

    const now = new Date();
    const updated = await tx.shipment.updateMany({
      where: {
        id: shipment.id,
        merchantId,
        type: 'merchant_restock',
        status: 'delivered',
      },
      data: {
        status: 'received',
        receivedAt: now,
        receivedByMerchantUserId: merchantUserId,
      },
    });
    if (updated.count !== 1) throw new Error('出貨狀態已變更，請重新整理');

    await applyMerchantRestockFromShipment(
      tx,
      {
        shipmentNumber: shipment.shipmentNumber,
        merchantId,
        items: shipment.items,
      },
      now,
    );

    await tx.statusAuditLog.create({
      data: {
        entityType: 'shipment',
        entityId: shipment.id,
        previousStatus: 'delivered',
        newStatus: 'received',
        actorType: 'merchant_user',
        actorId: merchantUserId,
        metadataJson: JSON.stringify({ source: 'pos_restock_receipt' }),
      },
    });
  });

  revalidatePath('/pos');
  revalidatePath('/pos/stock');
  revalidatePath('/pos/restock/progress');
  revalidatePath(`/pos/restock/${requestId}`);
  revalidatePath('/shipments');
  revalidatePath('/restock-requests');
  redirect(`/pos/restock/${requestId}?received=1`);
}
