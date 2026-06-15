import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type ProductRow = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  sourceSku: string | null;
  createdAt: Date;
  _count: {
    orderItems: number;
    shipmentItems: number;
    priceTiers: number;
    merchantRules: number;
    merchantStocks: number;
    inventoryBalances: number;
  };
};

export function normalizeProductName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function keeperScore(p: ProductRow) {
  return (
    p._count.priceTiers * 1000 +
    (p.sourceSku ? 500 : 0) +
    (p._count.orderItems + p._count.shipmentItems) * 100 +
    p._count.merchantRules * 10 +
    p._count.merchantStocks +
    p._count.inventoryBalances
  );
}

export function pickKeeper(products: ProductRow[]): ProductRow {
  return [...products].sort((a, b) => {
    const scoreDiff = keeperScore(b) - keeperScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.productId.localeCompare(b.productId);
  })[0];
}

async function mergeMerchantRules(
  tx: Prisma.TransactionClient,
  fromId: string,
  toId: string,
) {
  const fromRules = await tx.merchantProductRule.findMany({ where: { productId: fromId } });
  for (const rule of fromRules) {
    const conflict = await tx.merchantProductRule.findUnique({
      where: { merchantId_productId: { merchantId: rule.merchantId, productId: toId } },
    });
    if (conflict) {
      await tx.merchantProductRule.delete({ where: { id: rule.id } });
    } else {
      await tx.merchantProductRule.update({
        where: { id: rule.id },
        data: { productId: toId },
      });
    }
  }
}

async function mergeMerchantStocks(
  tx: Prisma.TransactionClient,
  fromId: string,
  toId: string,
) {
  const fromStocks = await tx.merchantStock.findMany({ where: { productId: fromId } });
  for (const stock of fromStocks) {
    const existing = await tx.merchantStock.findUnique({
      where: {
        merchantId_productId_tierId: {
          merchantId: stock.merchantId,
          productId: toId,
          tierId: stock.tierId,
        },
      },
    });
    if (existing) {
      await tx.merchantStock.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + stock.quantity },
      });
      await tx.merchantStock.delete({ where: { id: stock.id } });
    } else {
      await tx.merchantStock.update({
        where: { id: stock.id },
        data: { productId: toId },
      });
    }
  }
}

async function mergeInventoryBalances(
  tx: Prisma.TransactionClient,
  fromId: string,
  toId: string,
) {
  const fromBalances = await tx.inventoryBalance.findMany({ where: { productId: fromId } });
  for (const bal of fromBalances) {
    const existing = await tx.inventoryBalance.findUnique({
      where: { productId_warehouseId: { productId: toId, warehouseId: bal.warehouseId } },
    });
    if (existing) {
      await tx.inventoryBalance.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + bal.quantity },
      });
      await tx.inventoryBalance.delete({ where: { id: bal.id } });
    } else {
      await tx.inventoryBalance.update({
        where: { id: bal.id },
        data: { productId: toId },
      });
    }
  }
}

async function mergePriceTiers(tx: Prisma.TransactionClient, fromId: string, toId: string) {
  const fromTiers = await tx.productPriceTier.findMany({ where: { productId: fromId } });
  for (const tier of fromTiers) {
    const conflict = await tx.productPriceTier.findFirst({
      where: {
        productId: toId,
        weightGrams: tier.weightGrams,
        unit: tier.unit,
        unitQty: tier.unitQty,
      },
    });
    if (conflict) {
      await tx.productPriceTier.delete({ where: { id: tier.id } });
    } else {
      await tx.productPriceTier.update({
        where: { id: tier.id },
        data: { productId: toId },
      });
    }
  }
}

export async function mergeProductIntoKeeper(fromId: string, toId: string) {
  if (fromId === toId) return;

  await prisma.$transaction(
    async (tx) => {
      const [from, to] = await Promise.all([
        tx.product.findUnique({ where: { id: fromId } }),
        tx.product.findUnique({ where: { id: toId } }),
      ]);
      if (!from || !to) throw new Error('商品不存在');

      await tx.orderItem.updateMany({ where: { productId: fromId }, data: { productId: toId } });
      await tx.shipmentItem.updateMany({ where: { productId: fromId }, data: { productId: toId } });
      await tx.merchantStockTxn.updateMany({ where: { productId: fromId }, data: { productId: toId } });
      await tx.inventoryTransaction.updateMany({
        where: { productId: fromId },
        data: { productId: toId },
      });

      await mergeMerchantRules(tx, fromId, toId);
      await mergeMerchantStocks(tx, fromId, toId);
      await mergeInventoryBalances(tx, fromId, toId);
      await mergePriceTiers(tx, fromId, toId);

      if (!to.sourceSku && from.sourceSku) {
        await tx.product.update({ where: { id: toId }, data: { sourceSku: from.sourceSku } });
      }

      await tx.merchantStockTxn.deleteMany({ where: { productId: fromId } });
      await tx.merchantStock.deleteMany({ where: { productId: fromId } });
      await tx.merchantProductRule.deleteMany({ where: { productId: fromId } });
      await tx.inventoryTransaction.deleteMany({ where: { productId: fromId } });
      await tx.inventoryBalance.deleteMany({ where: { productId: fromId } });
      await tx.productPriceTier.deleteMany({ where: { productId: fromId } });
      await tx.product.delete({ where: { id: fromId } });
    },
    { maxWait: 15_000, timeout: 120_000 },
  );
}

export async function findDuplicateProductGroups() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      productId: true,
      sku: true,
      name: true,
      sourceSku: true,
      createdAt: true,
      _count: {
        select: {
          orderItems: true,
          shipmentItems: true,
          priceTiers: true,
          merchantRules: true,
          merchantStocks: true,
          inventoryBalances: true,
        },
      },
    },
    orderBy: { productId: 'asc' },
  });

  const byName = new Map<string, ProductRow[]>();
  for (const p of products) {
    const key = normalizeProductName(p.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(p);
  }

  return [...byName.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([name, list]) => ({
      name,
      keeper: pickKeeper(list),
      duplicates: list.filter((p) => p.id !== pickKeeper(list).id),
    }));
}

export async function dedupeProductsByName(dryRun = false) {
  const groups = await findDuplicateProductGroups();
  const actions: Array<{ name: string; keep: string; remove: string[] }> = [];

  for (const group of groups) {
    const removeIds = group.duplicates.map((p) => p.productId);
    actions.push({
      name: group.name,
      keep: group.keeper.productId,
      remove: removeIds,
    });

    if (!dryRun) {
      for (const dup of group.duplicates) {
        await mergeProductIntoKeeper(dup.id, group.keeper.id);
      }
    }
  }

  return { groupCount: groups.length, actions };
}
