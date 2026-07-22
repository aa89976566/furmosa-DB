import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { SHIPPING_CARRIER_DELIVERY } from '@/lib/shipping-policy';

/** 淡水柒沐（柒木）寵物美容：直接送貨地址 */
export const QIMU_DELIVERY_ADDRESS = '新北市淡水區北新路218號';
export const QIMU_DELIVERY_PHONE = '02-2628-3589';
export const QIMU_MERCHANT_ID = 'MER-0014';
export const QIMU_DISPLAY_NAME = '柒沐寵物美容';

export function isQimuMerchantName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim();
  if (!n) return false;
  if (
    n === '柒沐寵物美容' ||
    n === '柒木寵物美容' ||
    n === '淡水柒沐寵物美容' ||
    n === '淡水柒木寵物美容'
  ) {
    return true;
  }
  const hasBeauty = n.includes('寵物美容');
  return hasBeauty && (n.includes('柒沐') || n.includes('柒木'));
}

/**
 * 確保淡水柒沐為「送貨」並寫入店址；待出貨寄賣單／關聯訂單一併補齊。
 * 出貨列隊／店家頁載入時呼叫（與豬窩分店 ensure 同模式）。
 */
export async function ensureQimuDeliveryShipping(
  db: PrismaClient = prisma,
): Promise<{ merchantId: string; updated: boolean } | null> {
  const candidates = await db.merchant.findMany({
    where: {
      OR: [
        { merchantId: QIMU_MERCHANT_ID },
        { name: { contains: '柒沐' } },
        { name: { contains: '柒木' } },
      ],
    },
    select: {
      id: true,
      merchantId: true,
      name: true,
      preferredCarrier: true,
      pickupStoreName: true,
      address: true,
      city: true,
      phone: true,
      contactName: true,
    },
  });

  const merchant =
    candidates.find((m) => m.merchantId === QIMU_MERCHANT_ID) ??
    candidates.find((m) => isQimuMerchantName(m.name)) ??
    null;

  if (!merchant) return null;

  const needsMerchantUpdate =
    merchant.preferredCarrier !== SHIPPING_CARRIER_DELIVERY ||
    merchant.pickupStoreName != null ||
    (merchant.address ?? '').trim() !== QIMU_DELIVERY_ADDRESS ||
    !(merchant.city ?? '').trim() ||
    !(merchant.phone ?? '').trim();

  if (needsMerchantUpdate) {
    await db.$executeRaw`
      UPDATE "Merchant"
      SET
        "preferredCarrier" = ${SHIPPING_CARRIER_DELIVERY},
        "pickupStoreName" = NULL,
        "address" = ${QIMU_DELIVERY_ADDRESS},
        "city" = COALESCE(NULLIF(TRIM("city"), ''), '新北市淡水區'),
        "phone" = COALESCE(NULLIF(TRIM("phone"), ''), ${QIMU_DELIVERY_PHONE}),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${merchant.id}
    `;
  }

  const pendingShipments = await db.shipment.findMany({
    where: {
      merchantId: merchant.id,
      type: 'merchant_restock',
      status: { in: ['pending', 'packed'] },
    },
    select: {
      id: true,
      orderId: true,
      carrier: true,
      recipientAddress: true,
      recipientName: true,
      recipientPhone: true,
    },
  });

  let shipmentTouched = false;
  for (const shipment of pendingShipments) {
    const nextAddress =
      (shipment.recipientAddress ?? '').trim() || QIMU_DELIVERY_ADDRESS;
    const nextName =
      (shipment.recipientName ?? '').trim() ||
      (merchant.contactName ?? '').trim() ||
      merchant.name;
    const nextPhone =
      (shipment.recipientPhone ?? '').trim() ||
      (merchant.phone ?? '').trim() ||
      QIMU_DELIVERY_PHONE;
    const needsShipmentUpdate =
      shipment.carrier !== SHIPPING_CARRIER_DELIVERY ||
      (shipment.recipientAddress ?? '').trim() !== nextAddress ||
      (shipment.recipientName ?? '').trim() !== nextName ||
      (shipment.recipientPhone ?? '').trim() !== nextPhone;

    if (!needsShipmentUpdate) continue;
    shipmentTouched = true;
    await db.shipment.update({
      where: { id: shipment.id },
      data: {
        carrier: SHIPPING_CARRIER_DELIVERY,
        recipientAddress: nextAddress,
        recipientName: nextName,
        recipientPhone: nextPhone,
      },
    });

    if (shipment.orderId) {
      await db.order.update({
        where: { id: shipment.orderId },
        data: {
          shippingMethod: 'delivery',
          shippingAddress: nextAddress,
          cvsStoreName: null,
        },
      });
    }
  }

  return {
    merchantId: merchant.merchantId,
    updated: needsMerchantUpdate || shipmentTouched,
  };
}
