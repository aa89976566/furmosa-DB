import { prisma } from '@/lib/prisma';

export type MerchantRestockShipmentItem = {
  id: string;
  productName: string;
  quantity: number;
  sku: string;
  weightGrams: number | null;
  unit: string | null;
};

export type DirectMerchantRestockShipment = {
  id: string;
  shipmentNumber: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  packedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  receivedAt: Date | null;
  items: MerchantRestockShipmentItem[];
};

export type MerchantRestockShipmentLookup =
  | { kind: 'direct'; shipment: DirectMerchantRestockShipment }
  | { kind: 'linked_request'; requestId: string };

export type NewerMerchantRestockShipment = {
  id: string;
  shipmentNumber: string;
  status: string;
  shippedAt: Date | null;
};

export async function loadMerchantRestockShipment(
  shipmentId: string,
  merchantId: string,
): Promise<MerchantRestockShipmentLookup | null> {
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, merchantId, type: 'merchant_restock' },
    select: {
      id: true,
      shipmentNumber: true,
      status: true,
      carrier: true,
      trackingNumber: true,
      packedAt: true,
      shippedAt: true,
      deliveredAt: true,
      receivedAt: true,
      items: {
        select: {
          id: true,
          productName: true,
          quantity: true,
          sku: true,
          weightGrams: true,
          unit: true,
        },
      },
      restockRequest: { select: { id: true } },
    },
  });
  if (!shipment) return null;
  const { restockRequest, ...direct } = shipment;
  if (restockRequest) {
    return { kind: 'linked_request', requestId: restockRequest.id };
  }
  return { kind: 'direct', shipment: direct };
}

export async function loadNewerMerchantRestockShipment(
  merchantId: string,
  currentShipmentId: string,
): Promise<NewerMerchantRestockShipment | null> {
  return prisma.shipment.findFirst({
    where: {
      merchantId,
      type: 'merchant_restock',
      id: { not: currentShipmentId },
      status: { in: ['pending', 'packed', 'shipped', 'delivered'] },
      shippedAt: { not: null },
    },
    orderBy: { shippedAt: 'desc' },
    select: { id: true, shipmentNumber: true, status: true, shippedAt: true },
  });
}
