import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { upsertSuggestedMerchantRule } from '@/lib/merchant-auto-commission';
import { createRestockOrderWithShipment } from '@/lib/merchant-restock-order';
import { shipmentItemsFingerprint } from '@/lib/shipment-queue-filters';
import { listJarExchangeMerchants } from '@/lib/jar-exchange/partner-merchants';
import {
  JAR_OPS_TARGET_STOCK,
  suggestedRestockQty,
  type JarOpsProductCol,
} from '@/lib/jar-exchange/ops';

export type QuickRestockLine = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  currentStock: number;
};

export type QuickRestockResult =
  | {
      ok: true;
      duplicated?: boolean;
      orderId: string;
      shipmentId: string;
      shipmentNumber: string;
      merchantName: string;
      items: QuickRestockLine[];
    }
  | { ok: false; error: string };

async function assertJarExchangeMerchant(merchantId: string) {
  const merchants = await listJarExchangeMerchants();
  const merchant = merchants.find((m) => m.id === merchantId);
  if (!merchant) return null;
  return prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      name: true,
      contactName: true,
      phone: true,
      address: true,
      preferredCarrier: true,
    },
  });
}

async function listJarProductsForMerchant(
  merchantId: string,
  productIdFilter?: string,
): Promise<(JarOpsProductCol & { currentStock: number })[]> {
  const products = await prisma.product.findMany({
    where: {
      status: 'active',
      productCategory: 'JAR_EXCHANGE',
      ...(productIdFilter ? { id: productIdFilter } : {}),
    },
    select: { id: true, name: true, sku: true, unit: true },
    orderBy: { name: 'asc' },
  });

  if (productIdFilter && products.length === 0) {
    return [];
  }

  const stocks = await prisma.merchantStock.findMany({
    where: {
      merchantId,
      productId: { in: products.map((p) => p.id) },
    },
    select: { productId: true, quantity: true },
  });
  const qtyMap = new Map<string, number>();
  for (const s of stocks) {
    qtyMap.set(s.productId, (qtyMap.get(s.productId) ?? 0) + s.quantity);
  }

  return products.map((p) => ({
    ...p,
    currentStock: qtyMap.get(p.id) ?? 0,
  }));
}

function buildSuggestedLines(
  products: (JarOpsProductCol & { currentStock: number })[],
  onlyProductId?: string,
): QuickRestockLine[] {
  return products
    .filter((p) => !onlyProductId || p.id === onlyProductId)
    .map((p) => ({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      currentStock: p.currentStock,
      quantity: suggestedRestockQty(p.currentStock),
    }))
    .filter((line) => line.quantity > 0);
}

/**
 * 換罐計畫一鍵補貨：低庫存自動帶數量，建立寄賣進貨單＋出貨隊列。
 */
export async function quickRestockJarExchangeMerchant(input: {
  merchantId: string;
  productId?: string;
}): Promise<QuickRestockResult> {
  const merchant = await assertJarExchangeMerchant(input.merchantId);
  if (!merchant) {
    return { ok: false, error: '找不到換罐計畫店家' };
  }

  const catalog = await listJarProductsForMerchant(merchant.id, input.productId);
  if (catalog.length === 0) {
    return {
      ok: false,
      error: input.productId
        ? '找不到可補貨的換罐商品（需 productCategory=JAR_EXCHANGE）'
        : '尚無換罐商品主檔（請將商品 productCategory 設為 JAR_EXCHANGE）',
    };
  }

  const items = buildSuggestedLines(catalog, input.productId);
  if (items.length === 0) {
    return {
      ok: false,
      error: input.productId
        ? `此商品庫存已高於門檻，無需補貨（目標 ${JAR_OPS_TARGET_STOCK}）`
        : `目前無需補貨（目標在店 ${JAR_OPS_TARGET_STOCK}）`,
    };
  }

  const fingerprint = shipmentItemsFingerprint(
    items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
  );
  const recentCutoff = new Date(Date.now() - 10 * 60 * 1000);
  const recentPending = await prisma.shipment.findMany({
    where: {
      merchantId: merchant.id,
      type: 'merchant_restock',
      status: { in: ['pending', 'packed'] },
      createdAt: { gte: recentCutoff },
    },
    include: {
      items: { select: { productId: true, quantity: true } },
      order: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const duplicate = recentPending.find(
    (s) => shipmentItemsFingerprint(s.items) === fingerprint,
  );
  if (duplicate) {
    return {
      ok: true,
      duplicated: true,
      orderId: duplicate.orderId ?? duplicate.order?.id ?? '',
      shipmentId: duplicate.id,
      shipmentNumber: duplicate.shipmentNumber,
      merchantName: merchant.name,
      items,
    };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });

  const note = `換罐計畫一鍵補貨（目標庫存 ${JAR_OPS_TARGET_STOCK}）· 不計營收`;
  const { order, shipment } = await createRestockOrderWithShipment({
    merchantId: merchant.id,
    items: items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      weightGrams: null,
      unit: catalog.find((p) => p.id === it.productId)?.unit ?? null,
    })),
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    recipientName: merchant.contactName ?? merchant.name,
    recipientPhone: merchant.phone,
    recipientAddress: merchant.address,
    carrier: merchant.preferredCarrier ?? null,
    notes: note,
    paymentStatus: 'paid',
    shippingFeeType: 'unpaid',
    shippingMethod: 'delivery',
    shippingFee: 0,
    companyShippingCost: 0,
    discount: 0,
    total: 0,
  });

  for (const product of products) {
    await upsertSuggestedMerchantRule(prisma, merchant.id, product);
  }

  revalidatePath('/jar-exchange/ops');
  revalidatePath('/dashboard');
  revalidatePath('/orders');
  revalidatePath(`/orders/${order.id}`);
  revalidatePath(`/merchants/${merchant.id}`);
  revalidatePath('/merchants');
  revalidatePath('/shipments');

  return {
    ok: true,
    orderId: order.id,
    shipmentId: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    merchantName: merchant.name,
    items,
  };
}
