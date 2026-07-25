import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { upsertSuggestedMerchantRule } from '@/lib/merchant-auto-commission';
import { createRestockOrderWithShipment } from '@/lib/merchant-restock-order';
import { shipmentItemsFingerprint } from '@/lib/shipment-queue-filters';
import { listJarExchangeMerchants } from '@/lib/jar-exchange/partner-merchants';
import {
  JAR_OPS_TARGET_STOCK,
  merchantHasShippingProfile,
  suggestedRestockQty,
} from '@/lib/jar-exchange/ops';
import {
  isMultiWeightProduct,
  resolveTierIdFromWeightGrams,
  weightTiersForProduct,
} from '@/lib/merchant-stock-key';
import { CARRIER_711, format711RecipientAddress } from '@/lib/carrier-cvs';

export type QuickRestockLine = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  currentStock: number;
  weightGrams: number | null;
  unit: string | null;
  tierId: string;
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

async function loadJarMerchant(merchantId: string) {
  const jarMerchants = await listJarExchangeMerchants();
  if (!jarMerchants.some((m) => m.id === merchantId)) return null;
  return prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      name: true,
      contactName: true,
      phone: true,
      address: true,
      preferredCarrier: true,
      pickupStoreName: true,
    },
  });
}

function resolveRecipient(merchant: NonNullable<Awaited<ReturnType<typeof loadJarMerchant>>>) {
  if (!merchant || !merchantHasShippingProfile(merchant)) {
    return {
      ok: false as const,
      error:
        '此店缺少收件資料（姓名／電話，以及宅配地址或 7-11 取件門市）。請先到店家頁補齊後再一鍵補貨。',
    };
  }
  const carrier = (merchant.preferredCarrier ?? '').trim() || null;
  const recipientName = (merchant.contactName ?? merchant.name).trim();
  const recipientPhone = (merchant.phone ?? '').trim();
  if (carrier === CARRIER_711) {
    return {
      ok: true as const,
      carrier,
      recipientName,
      recipientPhone,
      recipientAddress: format711RecipientAddress(merchant.pickupStoreName!.trim()),
      shippingMethod: 'convenience' as const,
      cvsBrand: '711',
    };
  }
  return {
    ok: true as const,
    carrier,
    recipientName,
    recipientPhone,
    recipientAddress: (merchant.address ?? '').trim(),
    shippingMethod: 'delivery' as const,
    cvsBrand: null as string | null,
  };
}

async function buildSuggestedLines(
  merchantId: string,
  productIdFilter?: string,
): Promise<QuickRestockLine[] | { error: string }> {
  const products = await prisma.product.findMany({
    where: {
      status: 'active',
      productCategory: 'JAR_EXCHANGE',
      ...(productIdFilter ? { id: productIdFilter } : {}),
    },
    include: { priceTiers: { orderBy: { price: 'asc' } } },
    orderBy: { name: 'asc' },
  });
  if (products.length === 0) {
    return {
      error: productIdFilter
        ? '找不到可補貨的換罐商品'
        : '尚無換罐商品（請將商品類型設為 JAR_EXCHANGE）',
    };
  }

  const stocks = await prisma.merchantStock.findMany({
    where: {
      merchantId,
      productId: { in: products.map((p) => p.id) },
    },
    select: { productId: true, tierId: true, quantity: true },
  });

  const lines: QuickRestockLine[] = [];

  for (const product of products) {
    const tiers = product.priceTiers.map((t) => ({
      id: t.id,
      weightGrams: t.weightGrams,
      unit: t.unit,
      unitQty: t.unitQty,
    }));
    const multi = isMultiWeightProduct(tiers);
    const productStocks = stocks.filter((s) => s.productId === product.id);

    if (multi) {
      const weightTiers = weightTiersForProduct(tiers);
      let anyLow = false;
      for (const tier of weightTiers) {
        const qty =
          productStocks
            .filter((s) => s.tierId === tier.id)
            .reduce((sum, s) => sum + s.quantity, 0) || 0;
        const need = suggestedRestockQty(qty);
        if (need <= 0) continue;
        anyLow = true;
        lines.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: need,
          currentStock: qty,
          weightGrams: tier.weightGrams,
          unit: tier.unit,
          tierId: tier.id,
        });
      }
      // 商品合計偏低但各規格列都沒有（或只在 legacy）→ 要求手動選規格
      const totalQty = productStocks.reduce((sum, s) => sum + s.quantity, 0);
      if (!anyLow && suggestedRestockQty(totalQty) > 0) {
        return {
          error: `「${product.name}」有多種克數規格，請至店家進貨頁手動選擇規格後補貨`,
        };
      }
      continue;
    }

    const totalQty = productStocks.reduce((sum, s) => sum + s.quantity, 0);
    const need = suggestedRestockQty(totalQty);
    if (need <= 0) continue;
    const tierId = resolveTierIdFromWeightGrams(tiers, tiers[0]?.weightGrams ?? null);
    const tier = tiers.find((t) => t.id === tierId) ?? tiers[0];
    lines.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: need,
      currentStock: totalQty,
      weightGrams: tier?.weightGrams ?? null,
      unit: tier?.unit ?? product.unit,
      tierId,
    });
  }

  return lines;
}

export async function quickRestockJarExchangeMerchant(input: {
  merchantId: string;
  productId?: string;
}): Promise<QuickRestockResult> {
  const merchant = await loadJarMerchant(input.merchantId);
  if (!merchant) return { ok: false, error: '找不到換罐計畫店家' };

  const recipient = resolveRecipient(merchant);
  if (!recipient.ok) return { ok: false, error: recipient.error };

  const built = await buildSuggestedLines(merchant.id, input.productId);
  if ('error' in built) return { ok: false, error: built.error };
  const items = built;
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
    where: { id: { in: [...new Set(items.map((i) => i.productId))] } },
  });

  const note = `換罐計畫一鍵補貨（目標庫存 ${JAR_OPS_TARGET_STOCK}）· 不計營收`;
  const { order, shipment } = await createRestockOrderWithShipment({
    merchantId: merchant.id,
    items: items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      weightGrams: it.weightGrams,
      unit: it.unit,
    })),
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    recipientName: recipient.recipientName,
    recipientPhone: recipient.recipientPhone,
    recipientAddress: recipient.recipientAddress,
    carrier: recipient.carrier,
    notes: note,
    paymentStatus: 'paid',
    shippingFeeType: 'unpaid',
    shippingMethod: recipient.shippingMethod,
    shippingFee: 0,
    companyShippingCost: 0,
    discount: 0,
    total: 0,
    cvsBrand: recipient.cvsBrand,
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
