import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { merchantCommissionPerUnit } from '@/lib/merchant-product-catalog';
import { unitPriceForTierSale } from '@/lib/merchant-product-tier';
import { variationLabel } from '@/lib/product-variations';

export type CheckoutCatalogItem = {
  key: string;
  productId: string;
  tierId: string;
  name: string;
  specLabel: string;
  sku: string;
  unitPrice: number;
  stock: number;
};

export async function loadCheckoutCatalog(merchantId: string): Promise<CheckoutCatalogItem[]> {
  const stocks = await prisma.merchantStock.findMany({
    where: { merchantId, quantity: { gt: 0 }, product: { status: 'active' } },
    include: {
      product: {
        include: {
          priceTiers: { orderBy: { price: 'asc' } },
          merchantRules: { where: { merchantId }, take: 1 },
        },
      },
    },
    orderBy: [{ product: { name: 'asc' } }],
  });

  return stocks.map((stock) => {
    const product = stock.product;
    const rule = product.merchantRules[0] ?? null;
    const tier =
      product.priceTiers.find((item) => item.id === stock.tierId) ??
      (stock.tierId === '' ? product.priceTiers[0] ?? null : null);
    const unitPrice = unitPriceForTierSale(product.priceTiers, stock.tierId, {
      suggestedPrice: rule?.suggestedPrice ?? null,
      hasMerchantRule: Boolean(rule),
      fallbackPrice: product.price,
    });
    return {
      key: `${product.id}:${stock.tierId}`,
      productId: product.id,
      tierId: stock.tierId,
      name: product.name,
      specLabel: tier ? variationLabel(tier) : product.unit || '單件',
      sku: product.sku,
      unitPrice,
      stock: stock.quantity,
    };
  });
}

type CheckoutInput = {
  merchantId: string;
  merchantUserId: string;
  items: { productId: string; tierId: string; quantity: number }[];
};

export async function completePosCheckout(input: CheckoutInput) {
  const cleaned = input.items.map((item) => ({
    productId: item.productId.trim(),
    tierId: item.tierId.trim(),
    quantity: Math.floor(Number(item.quantity)),
  }));
  if (cleaned.length === 0 || cleaned.some((item) => !item.productId || !Number.isSafeInteger(item.quantity) || item.quantity <= 0)) {
    throw new Error('EMPTY_CART');
  }
  const uniqueKeys = new Set(cleaned.map((item) => `${item.productId}:${item.tierId}`));
  if (uniqueKeys.size !== cleaned.length) throw new Error('INVALID_CART');

  return prisma.$transaction(async (tx) => {
    const productIds = cleaned.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, status: 'active' },
      include: {
        priceTiers: { orderBy: { price: 'asc' } },
        merchantRules: { where: { merchantId: input.merchantId }, take: 1 },
      },
    });
    if (products.length !== new Set(productIds).size) throw new Error('PRODUCT_NOT_AVAILABLE');
    const byId = new Map(products.map((product) => [product.id, product]));

    const priced = cleaned.map((item) => {
      const product = byId.get(item.productId)!;
      const rule = product.merchantRules[0] ?? null;
      const tier =
        product.priceTiers.find((row) => row.id === item.tierId) ??
        (item.tierId === '' ? product.priceTiers[0] ?? null : null);
      if (item.tierId !== '' && !tier) throw new Error('PRODUCT_NOT_AVAILABLE');
      const unitPrice = unitPriceForTierSale(product.priceTiers, item.tierId, {
        suggestedPrice: rule?.suggestedPrice ?? null,
        hasMerchantRule: Boolean(rule),
        fallbackPrice: product.price,
      });
      const subtotal = unitPrice * item.quantity;
      const commissionAmount = merchantCommissionPerUnit(rule, unitPrice) * item.quantity;
      return { ...item, product, rule, tier, unitPrice, subtotal, commissionAmount };
    });
    const subtotal = priced.reduce((sum, item) => sum + item.subtotal, 0);
    const token = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    const orderNumber = `POS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${token}`;
    const now = new Date();

    const order = await tx.order.create({
      data: {
        orderNumber,
        source: 'consignment',
        status: 'completed',
        paymentStatus: 'paid',
        fulfillmentStatus: 'delivered',
        shippingFeeType: 'free',
        shippingMethod: 'delivery',
        merchantId: input.merchantId,
        subtotal,
        total: subtotal,
        orderedAt: now,
        completedAt: now,
        note: `POS 門市收款｜操作人員 ${input.merchantUserId}`,
        items: {
          create: priced.map((item) => ({
            productId: item.product.id,
            productName: item.tier ? `${item.product.name} ${variationLabel(item.tier)}` : item.product.name,
            sku: item.product.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            unitCost: item.tier?.cost ?? null,
            weightGrams: item.tier?.weightGrams ?? null,
            unit: item.tier?.unit ?? item.product.unit,
          })),
        },
      },
    });

    for (const item of priced) {
      const changed = await tx.merchantStock.updateMany({
        where: {
          merchantId: input.merchantId,
          productId: item.productId,
          tierId: item.tierId,
          quantity: { gte: item.quantity },
        },
        data: { quantity: { decrement: item.quantity }, lastSaleAt: now },
      });
      if (changed.count !== 1) throw new Error('OUT_OF_STOCK');

      const stock = await tx.merchantStock.findUnique({
        where: { merchantId_productId_tierId: { merchantId: input.merchantId, productId: item.productId, tierId: item.tierId } },
        select: { quantity: true },
      });
      if (!stock) throw new Error('OUT_OF_STOCK');
      await tx.merchantStockTxn.create({
        data: {
          txnNumber: `MTXN-${token}-${randomUUID().slice(0, 8).toUpperCase()}`,
          merchantId: input.merchantId,
          productId: item.productId,
          type: 'sale',
          quantity: -item.quantity,
          balanceAfter: stock.quantity,
          unitPrice: item.unitPrice,
          commissionAmount: item.commissionAmount,
          companyRevenue: item.subtotal - item.commissionAmount,
          orderId: order.id,
          note: item.tier ? `${variationLabel(item.tier)} · POS 門市銷售` : 'POS 門市銷售',
        },
      });
    }

    return { orderNumber: order.orderNumber };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
