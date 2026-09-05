'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireMerchantSession } from '@/lib/merchant-auth';
import {
  applyMerchantRestockFromShipment,
  validateRestockReceiptShipment,
} from '@/lib/merchant-restock-inventory';

export type ConfirmRestockReceiptState =
  | { status: 'idle' }
  | { status: 'just_received'; message: string }
  | { status: 'already_received'; message: string }
  | { status: 'failed'; message: string };

export async function confirmRestockReceiptAction(
  _previousState: ConfirmRestockReceiptState,
  formData: FormData,
): Promise<ConfirmRestockReceiptState> {
  const session = await requireMerchantSession();
  const { merchantId, merchantUserId } = session;
  const requestId = String(formData.get('requestId') ?? '').trim();
  if (!requestId) return { status: 'failed', message: '現在不能確認收貨，請再試一次。' };

  try {
    const result = await prisma.$transaction(async (tx) => {
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
    if (validateRestockReceiptShipment(shipment, merchantId) === 'already_received') {
      return 'already_received' as const;
    }

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
    if (updated.count !== 1) {
      const latest = await tx.shipment.findFirst({
        where: { id: shipment.id, merchantId },
        select: { status: true },
      });
      if (latest?.status === 'received') return 'already_received' as const;
      throw new Error('出貨狀態已變更');
    }

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
    return 'just_received' as const;
    });

    revalidatePath('/pos');
    revalidatePath('/pos/stock');
    revalidatePath('/pos/restock/progress');
    revalidatePath(`/pos/restock/${requestId}`);
    revalidatePath('/shipments');
    revalidatePath('/restock-requests');

    return result === 'just_received'
      ? { status: 'just_received', message: '已確認收貨，商品已加入店內庫存。' }
      : { status: 'already_received', message: '這筆補貨已完成收貨。' };
  } catch {
    return { status: 'failed', message: '現在不能確認收貨，請再試一次。' };
  }
}
