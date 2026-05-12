// Strip Xg from all product names, merging any duplicates.
//   - g 數現在記在 ShipmentItem / OrderItem 上，產品 master 只記品項
//   - 例：簡記牛肉地瓜50g → 簡記牛肉地瓜
//   - 若同名（無 g）的產品已存在，將所有 FK 引用搬到那個 keeper，再刪掉這筆
//
// 可重跑（idempotent）。
import { PrismaClient } from '@prisma/client';
import { parseWeightFromName } from '../lib/product-label';

const prisma = new PrismaClient();

function stripGram(name: string): string {
  // 把名字結尾或中間的 "50g" / " 50 g" 等去掉，並修剪多餘空白
  return name.replace(/\s*\d+\s*g\b/gi, '').replace(/\s+/g, ' ').trim();
}

async function migrateProductRefs(fromId: string, toId: string) {
  // 一條一條處理 unique 衝突
  // 1. MerchantProductRule (unique merchantId+productId)
  const rules = await prisma.merchantProductRule.findMany({ where: { productId: fromId } });
  for (const r of rules) {
    const existing = await prisma.merchantProductRule.findUnique({
      where: { merchantId_productId: { merchantId: r.merchantId, productId: toId } },
    });
    if (existing) {
      // 已有 keeper 的規則，刪掉 dupe（保留 keeper 的價格/抽成）
      await prisma.merchantProductRule.delete({ where: { id: r.id } });
    } else {
      await prisma.merchantProductRule.update({ where: { id: r.id }, data: { productId: toId } });
    }
  }

  // 2. MerchantStock (unique merchantId+productId) — 合併 quantity
  const stocks = await prisma.merchantStock.findMany({ where: { productId: fromId } });
  for (const s of stocks) {
    const existing = await prisma.merchantStock.findUnique({
      where: { merchantId_productId: { merchantId: s.merchantId, productId: toId } },
    });
    if (existing) {
      await prisma.merchantStock.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + s.quantity,
          lastRestockAt:
            s.lastRestockAt && (!existing.lastRestockAt || s.lastRestockAt > existing.lastRestockAt)
              ? s.lastRestockAt
              : existing.lastRestockAt,
          lastSaleAt:
            s.lastSaleAt && (!existing.lastSaleAt || s.lastSaleAt > existing.lastSaleAt)
              ? s.lastSaleAt
              : existing.lastSaleAt,
        },
      });
      await prisma.merchantStock.delete({ where: { id: s.id } });
    } else {
      await prisma.merchantStock.update({ where: { id: s.id }, data: { productId: toId } });
    }
  }

  // 3. MerchantStockTxn — 沒 unique，直接 updateMany
  await prisma.merchantStockTxn.updateMany({
    where: { productId: fromId },
    data: { productId: toId },
  });

  // 4. InventoryBalance (unique productId+warehouseId) — 合併 quantity
  const bals = await prisma.inventoryBalance.findMany({ where: { productId: fromId } });
  for (const b of bals) {
    const existing = await prisma.inventoryBalance.findUnique({
      where: { productId_warehouseId: { productId: toId, warehouseId: b.warehouseId } },
    });
    if (existing) {
      await prisma.inventoryBalance.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + b.quantity },
      });
      await prisma.inventoryBalance.delete({ where: { id: b.id } });
    } else {
      await prisma.inventoryBalance.update({ where: { id: b.id }, data: { productId: toId } });
    }
  }

  // 5. InventoryTransaction — updateMany
  await prisma.inventoryTransaction.updateMany({
    where: { productId: fromId },
    data: { productId: toId },
  });

  // 6. OrderItem — updateMany；同時補 weightGrams 預設值
  const detected = await prisma.product
    .findUnique({ where: { id: fromId } })
    .then((p) => (p ? parseWeightFromName(p.name) : null));
  await prisma.orderItem.updateMany({
    where: { productId: fromId, weightGrams: null },
    data: { productId: toId, ...(detected ? { weightGrams: detected } : {}) },
  });
  await prisma.orderItem.updateMany({
    where: { productId: fromId },
    data: { productId: toId },
  });

  // 7. ShipmentItem — updateMany；同時補 weightGrams 預設值
  await prisma.shipmentItem.updateMany({
    where: { productId: fromId, weightGrams: null },
    data: { productId: toId, ...(detected ? { weightGrams: detected } : {}) },
  });
  await prisma.shipmentItem.updateMany({
    where: { productId: fromId },
    data: { productId: toId },
  });
}

async function main() {
  console.log('🧹 開始清理產品名稱（去掉 Xg 後綴 + 合併重名）...\n');

  const products = await prisma.product.findMany({ orderBy: { sku: 'asc' } });
  console.log(`📦 目前共 ${products.length} 個產品\n`);

  let renamed = 0;
  let merged = 0;
  let untouched = 0;

  for (const p of products) {
    const stripped = stripGram(p.name);
    if (stripped === p.name) {
      untouched++;
      continue;
    }
    if (!stripped) {
      console.log(`⚠ ${p.sku} ${p.name} 去掉 g 後變空字串，跳過`);
      continue;
    }

    const keeper = await prisma.product.findFirst({
      where: { name: stripped, NOT: { id: p.id } },
      orderBy: { sku: 'asc' },
    });

    if (!keeper) {
      // 沒衝突，直接改名
      await prisma.product.update({ where: { id: p.id }, data: { name: stripped } });
      console.log(`✏  ${p.sku}  ${p.name}  →  ${stripped}`);
      renamed++;
    } else {
      // 把 p 合進 keeper，刪掉 p
      console.log(`🔀 合併 ${p.sku}「${p.name}」→ ${keeper.sku}「${keeper.name}」`);
      await migrateProductRefs(p.id, keeper.id);
      await prisma.product.delete({ where: { id: p.id } });
      merged++;
    }
  }

  console.log(`\n✅ 完成：改名 ${renamed} 筆 / 合併 ${merged} 筆 / 不變 ${untouched} 筆`);

  const after = await prisma.product.findMany({ orderBy: { sku: 'asc' } });
  console.log(`\n📦 處理後共 ${after.length} 個產品：`);
  for (const p of after) {
    console.log(`   ${p.sku.padEnd(10)}  ${p.name}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
