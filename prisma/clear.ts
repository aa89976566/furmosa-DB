// 清空所有業務資料；保留 4 個系統登入帳號 + 預設 3 個倉庫
// 使用：npm run db:clear
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

async function main() {
  console.log('🧹 清空業務資料中（保留登入帳號、倉庫、訂閱方案）...');

  // 子表先清
  await prisma.redemption.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.pointLedger.deleteMany();
  await prisma.subscriptionShipment.deleteMany();
  await prisma.subscription.deleteMany();
  // 不刪 subscriptionPlan：3 個方案是真實營運用，要保留
  await prisma.task.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.merchantStockTxn.deleteMany();
  await prisma.merchantStock.deleteMany();
  await prisma.merchantProductRule.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.productPriceTier.deleteMany();
  await prisma.product.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.vendor.deleteMany();
  // 倉庫保留（屬於系統設定）
  // 使用者保留（登入帳號）

  // 確保至少有一個 admin
  const adminCount = await prisma.user.count();
  if (adminCount === 0) {
    const passwordHash = await bcrypt.hash('furmosa2026', 10);
    await prisma.user.createMany({
      data: [
        { email: 'admin@furmosa.com', name: 'Furmosa Admin', role: 'admin', passwordHash },
      ],
    });
    console.log('  + 補建 admin@furmosa.com / furmosa2026');
  }

  // 確保有預設倉庫
  const whCount = await prisma.warehouse.count();
  if (whCount === 0) {
    await prisma.warehouse.createMany({
      data: [
        { code: 'WH-MAIN', name: '中央總倉', isDefault: true },
        { code: 'WH-CONSIGN', name: '寄賣調撥倉' },
      ],
    });
    console.log('  + 補建預設倉庫 WH-MAIN / WH-CONSIGN');
  }

  // 確保 3 個訂閱方案存在（小食組 / 標準組 / 豪華組）
  const planCount = await prisma.subscriptionPlan.count();
  if (planCount === 0) {
    await prisma.subscriptionPlan.createMany({
      data: [
        {
          planCode: 'PLAN-LIGHT',
          name: '小食組',
          tagline: '輕鬆入門',
          monthlyPrice: 399,
          halfYearPrice: 2100,
          halfYearSavings: 294,
          shipmentsPerMonth: 1,
          shipDays: JSON.stringify([15]),
          contents: JSON.stringify([
            { name: '凍乾粉', weight: '30g' },
            { name: '蛋白肉乾', weight: '80g' },
            { name: '綜合蔬果凍乾', weight: '南瓜30g + 櫛瓜15g' },
          ]),
          recommendedFor: '5kg 以下小型犬',
          sortOrder: 1,
        },
        {
          planCode: 'PLAN-STANDARD',
          name: '標準組',
          tagline: '嚐鮮首選',
          monthlyPrice: 599,
          halfYearPrice: 3160,
          halfYearSavings: 434,
          shipmentsPerMonth: 2,
          shipDays: JSON.stringify([1, 15]),
          contents: JSON.stringify([
            { name: '肉乾', weight: '每次 50g' },
            { name: '凍乾粉', weight: '每次 30g' },
            { name: '綜合蔬果凍乾', weight: '南瓜30g + 櫛瓜15g' },
          ]),
          bonusItems: JSON.stringify([{ name: '驚喜玩具', interval: 'monthly' }]),
          recommendedFor: '5-15kg 中型犬',
          sortOrder: 2,
        },
        {
          planCode: 'PLAN-DELUXE',
          name: '豪華組',
          tagline: '尊榮享受',
          monthlyPrice: 899,
          halfYearPrice: 4750,
          halfYearSavings: 644,
          shipmentsPerMonth: 2,
          shipDays: JSON.stringify([1, 15]),
          contents: JSON.stringify([
            { name: '肉乾', weight: '每次 70g' },
            { name: '凍乾粉', weight: '每次 50g' },
            { name: '綜合蔬果凍乾', weight: '南瓜30g + 櫛瓜15g' },
            { name: '特選凍乾', weight: '每次額外 +15g' },
          ]),
          bonusItems: JSON.stringify([{ name: '益智玩具', interval: 'monthly' }]),
          recommendedFor: '15kg 以上 / 多隻家庭',
          sortOrder: 3,
        },
      ],
    });
    console.log('  + 補建 3 個訂閱方案（小食組 / 標準組 / 豪華組）');
  }

  console.log('✅ 業務資料已全部清空');
  console.log('');
  console.log('保留：');
  console.log(`  - 使用者帳號 ${await prisma.user.count()} 筆`);
  console.log(`  - 倉庫 ${await prisma.warehouse.count()} 筆`);
  console.log(`  - 訂閱方案 ${await prisma.subscriptionPlan.count()} 筆`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
