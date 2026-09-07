import { prisma } from '@/lib/prisma';
import {
  applyMerchantRestockFromShipment,
  validateRestockReceiptShipment,
} from '@/lib/merchant-restock-inventory';

export type MerchantRestockReceiptResult = 'just_received' | 'already_received';

export async function confirmMerchantRestockReceipt(input: {
  shipmentId: string;
  merchantId: string;
  merchantUserId: string;
}): Promise<MerchantRestockReceiptResult> {
  const { shipmentId, merchantId, merchantUserId } = input;

  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, merchantId, type: 'merchant_restock' },
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
    });

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
        where: { id: shipment.id, merchantId, type: 'merchant_restock' },
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
}
