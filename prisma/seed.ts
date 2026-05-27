import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateShipmentDates, parseShipDays } from '../lib/subscription';
import { syncCustomerServices, ensureJarExchangeService } from '../lib/jar-exchange/services';
import { redeemJarCode } from '../lib/jar-exchange/redeem-code';
import { generateJarCode } from '../lib/jar-exchange/codes';

// 本機 seed 走 DIRECT_URL（5432，不經 PgBouncer），可避免 connection_limit=1 把幾千筆操作排隊到極慢
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const pad = (n: number, width = 4) => String(n).padStart(width, '0');
const monthTag = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
const pickOne = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const daysLater = (n: number) => daysAgo(-n);

async function reset() {
  // 子表先清；不然 Product / Merchant / Customer deleteMany 會被 FK 擋住
  await prisma.marketingCostRecord.deleteMany();
  await prisma.rewardRedemption.deleteMany();
  await prisma.memberPointsLedger.deleteMany();
  await prisma.jarCode.deleteMany();
  await prisma.rewardCatalog.deleteMany();
  await prisma.customerService.deleteMany();
  await prisma.subscriptionShipment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.task.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.merchantStockTxn.deleteMany();
  await prisma.merchantStock.deleteMany();
  await prisma.merchantProductRule.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.productPriceTier.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('🌱 Seeding Furmosa HQ ...');
  await reset();

  // ===== Users（預設密碼皆為 furmosa2026）=====
  const defaultPasswordHash = await bcrypt.hash('furmosa2026', 10);
  await prisma.user.createMany({
    data: [
      { email: 'admin@furmosa.com', name: '陳管理員', role: 'admin', passwordHash: defaultPasswordHash },
      { email: 'finance@furmosa.com', name: '林財務', role: 'finance', passwordHash: defaultPasswordHash },
      { email: 'ops@furmosa.com', name: '王營運', role: 'staff', passwordHash: defaultPasswordHash },
      { email: 'wh@furmosa.com', name: '張倉管', role: 'warehouse', passwordHash: defaultPasswordHash },
    ],
  });
  const users = await prisma.user.findMany();

  // ===== Vendors =====
  const vendorNames = [
    { name: '喜寵生技', contact: '李文哲', phone: '02-2345-1101' },
    { name: '毛孩工坊', contact: '黃雅婷', phone: '02-2345-1102' },
    { name: '山林牧場', contact: '陳大為', phone: '03-456-2201' },
    { name: '鮮萃漁業', contact: '林佩珊', phone: '07-789-3301' },
    { name: '純真烘焙坊', contact: '吳明宏', phone: '04-321-4401' },
    { name: '北歐凍品', contact: '蔡欣怡', phone: '02-2987-5501' },
    { name: '寶豆寵物原料', contact: '周建宏', phone: '02-2654-6601' },
    { name: '樂寵國際', contact: '謝雅玲', phone: '02-2987-7701' },
  ];
  for (let i = 0; i < vendorNames.length; i++) {
    const v = vendorNames[i];
    await prisma.vendor.create({
      data: {
        vendorId: `VEND-${pad(i + 1)}`,
        name: v.name,
        contactName: v.contact,
        phone: v.phone,
        email: `contact@${i}.vendor.tw`,
        address: `台北市中山區${randInt(1, 200)}號`,
        paymentTerms: pickOne(['月結 30 天', '月結 45 天', '出貨後付款']),
        status: 'active',
      },
    });
  }
  const vendors = await prisma.vendor.findMany();

  // ===== Customers =====
  const customerSeed: Array<{
    name: string;
    type?: 'individual' | 'business';
    lineUserId?: string;
    socialIg?: string;
  }> = [
    { name: '陳小明', lineUserId: 'U1000001' },
    { name: '林美麗', lineUserId: 'U1000002', socialIg: '@meili.pet' },
    { name: '王大文' },
    { name: '張雅婷', lineUserId: 'U1000004' },
    { name: '李志強' },
    { name: '黃淑芬', lineUserId: 'U1000006' },
    { name: '吳建宏', type: 'business' },
    { name: '蔡佳玲' },
    { name: '周思源', lineUserId: 'U1000009' },
    { name: '徐怡君' },
    { name: '劉俊傑' },
    { name: '許雅雯', lineUserId: 'U1000012', socialIg: '@yawen.dog' },
    { name: '鄭文豪' },
    { name: '何明珠', lineUserId: 'U1000014' },
    { name: '彭雅琪' },
    { name: '趙世昌', type: 'business' },
    { name: '楊淑慧' },
    { name: '潘建文' },
    { name: '馬曉菁', lineUserId: 'U1000019', socialIg: '@maxiao.cats' },
    { name: '高振宇' },
  ];

  for (let i = 0; i < customerSeed.length; i++) {
    const c = customerSeed[i];
    const orderDate = daysAgo(randInt(1, 60));
    await prisma.customer.create({
      data: {
        customerId: `CUST-${pad(i + 1)}`,
        name: c.name,
        type: c.type ?? 'individual',
        phone: `09${randInt(10000000, 99999999)}`,
        email: `customer${i + 1}@example.com`,
        address: `台北市${pickOne(['信義', '大安', '中山', '松山', '內湖'])}區某某路${randInt(1, 200)}號`,
        lineUserId: c.lineUserId ?? null,
        lineDisplay: c.lineUserId ? c.name : null,
        socialIg: c.socialIg ?? null,
        birthday: i % 3 === 0 ? new Date(1985 + randInt(0, 15), randInt(0, 11), randInt(1, 28)) : null,
        tags: JSON.stringify([]),
        totalSpent: randInt(500, 25000),
        lastOrderAt: orderDate,
      },
    });
  }
  const customers = await prisma.customer.findMany();

  // ===== Merchants =====
  const merchantNames = [
    { name: '汪汪選物所', city: '台北', type: 'consignment' },
    { name: '貓事務所', city: '台北', type: 'consignment' },
    { name: '寵幸生活館', city: '新北', type: 'consignment' },
    { name: '毛日子寵物店', city: '桃園', type: 'consignment' },
    { name: '小耳朵選品', city: '新竹', type: 'consignment' },
    { name: '風城貓窩', city: '新竹', type: 'consignment' },
    { name: '台中肉球研究所', city: '台中', type: 'consignment' },
    { name: '中部寵物市集', city: '台中', type: 'pop_up' },
    { name: '台南汪喵嚴選', city: '台南', type: 'consignment' },
    { name: '高雄毛孩生活館', city: '高雄', type: 'consignment' },
    { name: '宜蘭山中精品', city: '宜蘭', type: 'partner' },
    { name: 'Furmosa 旗艦店', city: '台北', type: 'flagship' },
  ];
  for (let i = 0; i < merchantNames.length; i++) {
    const m = merchantNames[i];
    await prisma.merchant.create({
      data: {
        merchantId: `MER-${pad(i + 1)}`,
        name: m.name,
        type: m.type,
        contactName: pickOne(['店長 王小華', '店主 陳大文', '經理 林雅芳']),
        phone: `0${randInt(2, 7)}-${randInt(2000, 8999)}-${randInt(1000, 9999)}`,
        email: `${m.name.replace(/\s/g, '')}@merchant.tw`,
        address: `${m.city}市某某路${randInt(1, 200)}號`,
        city: m.city,
        commissionRate: pickOne([0.25, 0.3, 0.35, 0.4]),
        status: 'active',
      },
    });
  }
  const merchants = await prisma.merchant.findMany();

  // ===== Warehouses =====
  await prisma.warehouse.createMany({
    data: [
      { code: 'WH-MAIN', name: '中央總倉（台北）', address: '台北市內湖區', isDefault: true },
      { code: 'WH-SOUTH', name: '南部倉儲（台南）', address: '台南市永康區' },
      { code: 'WH-CONSIGN', name: '寄賣調撥倉', address: '台北市內湖區（虛擬倉）' },
    ],
  });
  const warehouses = await prisma.warehouse.findMany();
  const mainWh = warehouses.find((w) => w.code === 'WH-MAIN')!;

  // ===== Products =====
  const productCatalog: Array<{ name: string; cat: string; price: number; cost: number }> = [
    { name: '鮮魚凍乾貓零食 50g', cat: 'freeze_dried', price: 320, cost: 145 },
    { name: '雞胸凍乾犬零食 80g', cat: 'freeze_dried', price: 280, cost: 120 },
    { name: '鴨肉凍乾貓零食 50g', cat: 'freeze_dried', price: 350, cost: 160 },
    { name: '鮭魚凍乾零食 60g', cat: 'freeze_dried', price: 360, cost: 165 },
    { name: '無穀全雞主食罐 80g', cat: 'staple_food', price: 75, cost: 32 },
    { name: '無穀鮭魚主食罐 80g', cat: 'staple_food', price: 78, cost: 34 },
    { name: '低敏鴨肉主食罐 165g', cat: 'staple_food', price: 110, cost: 48 },
    { name: '草飼牛主食罐 80g', cat: 'staple_food', price: 95, cost: 42 },
    { name: '幼貓配方主食罐 80g', cat: 'staple_food', price: 82, cost: 36 },
    { name: '高齡貓主食罐 80g', cat: 'staple_food', price: 88, cost: 38 },
    { name: '三線鯖魚軟質零食', cat: 'treats', price: 150, cost: 65 },
    { name: '雞肉軟絲零食 100g', cat: 'treats', price: 160, cost: 70 },
    { name: '寵物用山羊奶 200ml', cat: 'treats', price: 89, cost: 38 },
    { name: '紐西蘭鹿筋潔牙骨', cat: 'treats', price: 220, cost: 95 },
    { name: '蔬果脆片零食', cat: 'treats', price: 130, cost: 55 },
    { name: '貓專用化毛膏 100g', cat: 'health', price: 380, cost: 165 },
    { name: '寵物關節保健粉 60g', cat: 'health', price: 580, cost: 248 },
    { name: '腸胃益生菌 30 包', cat: 'health', price: 680, cost: 290 },
    { name: '魚油 Omega-3 100ml', cat: 'health', price: 720, cost: 305 },
    { name: '心臟保健 Q10 60 錠', cat: 'health', price: 880, cost: 380 },
    { name: '皮毛亮澤精華 50ml', cat: 'health', price: 520, cost: 220 },
    { name: '貓抓板 - 紙箱款', cat: 'toys', price: 280, cost: 120 },
    { name: '逗貓棒 - 羽毛款', cat: 'toys', price: 120, cost: 45 },
    { name: '雷射逗貓筆', cat: 'toys', price: 180, cost: 65 },
    { name: '互動益智餵食球', cat: 'toys', price: 350, cost: 145 },
    { name: '繩結啃咬玩具 (大)', cat: 'toys', price: 260, cost: 105 },
    { name: '不鏽鋼食碗 (中)', cat: 'accessories', price: 320, cost: 135 },
    { name: '陶瓷雙層碗', cat: 'accessories', price: 480, cost: 195 },
    { name: '便攜寵物水壺 350ml', cat: 'accessories', price: 390, cost: 160 },
    { name: '可調式項圈 (M)', cat: 'accessories', price: 280, cost: 110 },
    { name: '可調式項圈 (L)', cat: 'accessories', price: 320, cost: 125 },
    { name: '寵物外出包 - 透氣款', cat: 'accessories', price: 1280, cost: 545 },
    { name: '貓砂盆 - 全罩式', cat: 'accessories', price: 980, cost: 420 },
    { name: '加厚舒眠寵物床 (M)', cat: 'accessories', price: 880, cost: 365 },
    { name: '寵物用消臭噴霧 250ml', cat: 'accessories', price: 280, cost: 115 },
    { name: '寵物用洗澡海綿', cat: 'accessories', price: 150, cost: 60 },
    { name: '無穀低敏全價犬糧 1.5kg', cat: 'staple_food', price: 680, cost: 295 },
    { name: '無穀低敏全價貓糧 1.5kg', cat: 'staple_food', price: 720, cost: 310 },
    { name: '幼犬專用糧 800g', cat: 'staple_food', price: 420, cost: 180 },
    { name: '高齡犬處方糧 1.2kg', cat: 'staple_food', price: 780, cost: 335 },
  ];

  for (let i = 0; i < productCatalog.length; i++) {
    const p = productCatalog[i];
    await prisma.product.create({
      data: {
        productId: `PROD-${pad(i + 1)}`,
        sku: `SKU-${pad(i + 1, 5)}`,
        name: p.name,
        category: p.cat,
        description: `${p.name} - 嚴選原料，無添加香料色素，Furmosa 嚴格把關。`,
        unit: '件',
        price: p.price,
        cost: p.cost,
        reorderPoint: randInt(5, 30),
        status: 'active',
        vendorId: pickOne(vendors).id,
      },
    });
  }
  const products = await prisma.product.findMany();

  // ===== Inventory =====
  let invSeq = 1;
  for (const p of products) {
    const initialQty = randInt(20, 200);
    for (const wh of warehouses) {
      const qty =
        wh.code === 'WH-MAIN'
          ? initialQty
          : wh.code === 'WH-SOUTH'
          ? randInt(10, 80)
          : randInt(0, 25);
      await prisma.inventoryBalance.create({
        data: { productId: p.id, warehouseId: wh.id, quantity: qty },
      });
      if (wh.code === 'WH-MAIN') {
        await prisma.inventoryTransaction.create({
          data: {
            txnNumber: `INV-${monthTag(daysAgo(45))}-${pad(invSeq++, 3)}`,
            type: 'purchase_in',
            productId: p.id,
            warehouseId: wh.id,
            quantity: qty,
            unitCost: p.cost,
            reference: 'PO-OPENING',
            note: '期初進貨',
            createdAt: daysAgo(randInt(40, 60)),
          },
        });
      }
    }
  }

  // ===== Subscription Plans（依官網訂閱方案）=====
  const planSeed = [
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
      bonusItems: null,
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
  ];
  for (const p of planSeed) {
    await prisma.subscriptionPlan.create({ data: p });
  }
  const plans = await prisma.subscriptionPlan.findMany();

  // ===== Subscriptions（挑幾位客戶建立訂閱）=====
  // 6 位訂閱中、1 位暫停、1 位即將到期、1 位已到期 → 共 9 筆
  const subSeed: Array<{
    customerName: string;
    planCode: string;
    cycle: 'monthly' | 'halfyear';
    startDaysAgo: number;
    endDaysFromNow?: number; // 半年方案結束日
    status?: 'active' | 'paused' | 'expired';
  }> = [
    { customerName: '陳小明', planCode: 'PLAN-LIGHT', cycle: 'monthly', startDaysAgo: 90 },
    { customerName: '林美麗', planCode: 'PLAN-STANDARD', cycle: 'halfyear', startDaysAgo: 30, endDaysFromNow: 150 },
    { customerName: '張雅婷', planCode: 'PLAN-DELUXE', cycle: 'halfyear', startDaysAgo: 60, endDaysFromNow: 120 },
    { customerName: '黃淑芬', planCode: 'PLAN-STANDARD', cycle: 'monthly', startDaysAgo: 45 },
    { customerName: '蔡佳玲', planCode: 'PLAN-LIGHT', cycle: 'monthly', startDaysAgo: 120 },
    { customerName: '何明珠', planCode: 'PLAN-DELUXE', cycle: 'monthly', startDaysAgo: 7 },
    { customerName: '馬曉菁', planCode: 'PLAN-STANDARD', cycle: 'halfyear', startDaysAgo: 15, endDaysFromNow: 165 },
    { customerName: '高振宇', planCode: 'PLAN-STANDARD', cycle: 'monthly', startDaysAgo: 200, status: 'paused' },
    { customerName: '許雅雯', planCode: 'PLAN-LIGHT', cycle: 'halfyear', startDaysAgo: 200, endDaysFromNow: -10, status: 'expired' },
  ];

  let subSeq = 1;
  let shipSeq = 1;
  for (const s of subSeed) {
    const customer = customers.find((c) => c.name === s.customerName);
    const plan = plans.find((p) => p.planCode === s.planCode);
    if (!customer || !plan) continue;

    const startDate = daysAgo(s.startDaysAgo);
    const endDate = s.cycle === 'halfyear' && s.endDaysFromNow !== undefined
      ? daysLater(s.endDaysFromNow)
      : null;
    const status = s.status ?? 'active';

    const sub = await prisma.subscription.create({
      data: {
        subscriptionNo: `SUB-${monthTag(startDate)}-${pad(subSeq++, 3)}`,
        customerId: customer.id,
        planId: plan.id,
        status,
        billingCycle: s.cycle,
        startDate,
        endDate,
        recipientName: customer.name,
        recipientPhone: customer.phone ?? '0900-000-000',
        shippingAddress: customer.address ?? '台北市',
        notes: status === 'paused' ? '客戶通知出國，暫停 1 個月' : null,
        pausedAt: status === 'paused' ? daysAgo(5) : null,
      },
    });

    // 標記 customer.hasActiveSubscription
    if (status === 'active') {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { hasActiveSubscription: true },
      });
    }

    // 產生過去 + 未來 8 週的出貨
    const shipDays = parseShipDays(plan.shipDays);
    const allDates = generateShipmentDates({
      startDate,
      endDate,
      shipDays,
      rangeStart: startDate,
      rangeEnd: daysLater(60),
    });
    const now = new Date();
    let nextShipmentDate: Date | null = null;
    for (const date of allDates) {
      let shipmentStatus: 'pending' | 'packed' | 'shipped' | 'delivered' | 'skipped' = 'pending';
      let packedAt: Date | null = null;
      let shippedAt: Date | null = null;
      let deliveredAt: Date | null = null;

      if (status === 'expired' || status === 'paused') {
        if (date < now) {
          shipmentStatus = 'delivered';
          packedAt = new Date(date.getTime() - 86400000);
          shippedAt = date;
          deliveredAt = new Date(date.getTime() + 2 * 86400000);
        } else {
          shipmentStatus = 'skipped';
        }
      } else if (date < now) {
        shipmentStatus = 'delivered';
        packedAt = new Date(date.getTime() - 86400000);
        shippedAt = date;
        deliveredAt = new Date(date.getTime() + 2 * 86400000);
      } else {
        if (!nextShipmentDate) nextShipmentDate = date;
      }

      await prisma.subscriptionShipment.create({
        data: {
          shipmentNo: `SHIP-${monthTag(date)}-${pad(shipSeq++, 3)}`,
          subscriptionId: sub.id,
          scheduledDate: date,
          status: shipmentStatus,
          packedAt,
          shippedAt,
          deliveredAt,
          trackingNo: shippedAt ? `TW${randInt(1000000000, 9999999999)}` : null,
        },
      });
    }

    if (nextShipmentDate) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { nextShipmentDate },
      });
    }
  }

  // ===== Orders =====
  const sources = ['website', 'line', 'consignment', 'manual'] as const;
  const statuses = ['confirmed', 'packed', 'shipped', 'delivered', 'completed', 'completed', 'completed', 'cancelled'] as const;
  for (let i = 1; i <= 80; i++) {
    const source = pickOne(sources);
    const status = pickOne(statuses);
    const orderedAt = daysAgo(randInt(0, 29));
    const isConsign = source === 'consignment';
    const customer = pickOne(customers);
    const merchant = isConsign ? pickOne(merchants) : null;
    const itemCount = randInt(1, 4);

    const items: {
      productId: string;
      productName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }[] = [];
    let subtotal = 0;
    const usedProducts = new Set<string>();
    for (let j = 0; j < itemCount; j++) {
      let p = pickOne(products);
      while (usedProducts.has(p.id)) p = pickOne(products);
      usedProducts.add(p.id);
      const qty = randInt(1, 5);
      const unit = p.price;
      const sub = unit * qty;
      subtotal += sub;
      items.push({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        quantity: qty,
        unitPrice: unit,
        subtotal: sub,
      });
    }
    const shippingFeeType =
      source === 'website' && subtotal < 1500 ? 'free' : 'unpaid';
    const shippingMethod = 'home';
    const standardFee = 120; // 黑貓宅配
    const shippingFee = shippingFeeType === 'free' ? 0 : standardFee;
    const companyShippingCost = shippingFeeType === 'free' ? standardFee : 0;
    const discount = randInt(0, 1) === 1 ? Math.floor(subtotal * 0.05) : 0;
    const total = subtotal - discount + shippingFee;
    const completedAt =
      status === 'completed' || status === 'delivered'
        ? new Date(orderedAt.getTime() + 1000 * 60 * 60 * 24 * randInt(1, 3))
        : null;

    await prisma.order.create({
      data: {
        orderNumber: `ORD-${monthTag(orderedAt)}-${pad(i, 3)}`,
        source,
        status,
        paymentStatus: status === 'cancelled' ? 'refunded' : 'paid',
        fulfillmentStatus:
          status === 'completed'
            ? 'delivered'
            : status === 'shipped'
            ? 'shipped'
            : status === 'packed'
            ? 'packed'
            : 'pending',
        customerId: customer.id,
        merchantId: merchant?.id,
        subtotal,
        discount,
        shippingFee,
        companyShippingCost,
        shippingFeeType,
        shippingMethod,
        total,
        shippingAddress: customer.address ?? '',
        orderedAt,
        completedAt,
        items: { create: items },
      },
    });

    for (const it of items) {
      await prisma.inventoryTransaction.create({
        data: {
          txnNumber: `INV-${monthTag(orderedAt)}-${pad(invSeq++, 3)}`,
          type: 'sales_out',
          productId: it.productId,
          warehouseId: mainWh.id,
          quantity: it.quantity,
          reference: `ORD-${monthTag(orderedAt)}-${pad(i, 3)}`,
          note: `出貨：${source}`,
          createdAt: orderedAt,
        },
      });
    }
  }

  // 補滿 ~150 筆異動
  const totalNeeded = 150;
  const currentTxnCount = await prisma.inventoryTransaction.count();
  const remaining = Math.max(0, totalNeeded - currentTxnCount);
  for (let i = 0; i < remaining; i++) {
    const p = pickOne(products);
    const wh = pickOne(warehouses);
    const type = pickOne(['adjustment', 'stocktake', 'transfer', 'return_in']);
    await prisma.inventoryTransaction.create({
      data: {
        txnNumber: `INV-${monthTag(daysAgo(randInt(0, 29)))}-${pad(invSeq++, 3)}`,
        type,
        productId: p.id,
        warehouseId: wh.id,
        quantity: randInt(1, 10),
        reference: type === 'stocktake' ? `ST-${pad(i, 3)}` : null,
        note:
          type === 'stocktake'
            ? '月度盤點'
            : type === 'transfer'
            ? '倉間調撥'
            : type === 'return_in'
            ? '客戶退貨'
            : '人工調整',
        createdAt: daysAgo(randInt(0, 25)),
      },
    });
  }

  // ===== Settlements =====
  for (let i = 0; i < 12; i++) {
    const merchant = pickOne(merchants);
    const monthOffset = i % 3;
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() - monthOffset);
    periodEnd.setDate(0);
    const periodStart = new Date(periodEnd);
    periodStart.setDate(1);
    const grossSales = randInt(8000, 80000);
    const commissionRate = merchant.commissionRate;
    const commissionAmount = Math.round(grossSales * commissionRate);
    const rewardPayout = randInt(0, 1) ? randInt(200, 1500) : 0;
    const payable = commissionAmount + rewardPayout;
    const status = pickOne(['draft', 'reviewing', 'approved', 'paid']);
    await prisma.settlement.create({
      data: {
        settlementId: `SET-${monthTag(periodEnd)}-${pad(i + 1, 3)}`,
        merchantId: merchant.id,
        periodStart,
        periodEnd,
        grossSales,
        commissionRate,
        commissionAmount,
        rewardPayout,
        payable,
        status,
        paidAt: status === 'paid' ? new Date() : null,
        note: status === 'draft' ? '待業務確認銷售清單' : null,
      },
    });
  }

  // ===== 換罐會員範例 =====
  const jarRewards = [
    { name: '洗澡折 100', points: 5, face: 100, cost: 85 },
    { name: '免費零食兌換', points: 3, face: 50, cost: 35 },
    { name: '限定雞肉片', points: 8, face: 120, cost: 90 },
  ];
  for (let i = 0; i < jarRewards.length; i++) {
    const r = jarRewards[i];
    await prisma.rewardCatalog.create({
      data: {
        rewardCode: `JAR-RWD-${pad(i + 1, 3)}`,
        rewardName: r.name,
        rewardType: 'grooming_coupon',
        pointsRequired: r.points,
        couponFaceValue: r.face,
        internalCost: r.cost,
        activeStatus: 'active',
        sortOrder: i + 1,
      },
    });
  }

  const sampleCustomers = await prisma.customer.findMany({ take: 3, orderBy: { customerId: 'asc' } });
  for (const c of sampleCustomers) {
    await syncCustomerServices(prisma, c.id);
    await ensureJarExchangeService(prisma, c.id);
  }

  const batchNo = 'SEED-BATCH-001';
  const seedCodes: string[] = [];
  while (seedCodes.length < 5) {
    const code = generateJarCode();
    if (!seedCodes.includes(code)) seedCodes.push(code);
  }
  for (const code of seedCodes) {
    await prisma.jarCode.create({
      data: { code, batchNo, pointValue: 1, status: 'unused' },
    });
  }
  if (sampleCustomers[0]) {
    await redeemJarCode(sampleCustomers[0].id, seedCodes[0]);
  }

  // ===== Tasks =====
  const tasks: Array<{ title: string; type: string; priority: string; status: string }> = [
    { title: '彙整本月寄賣銷售明細', type: 'settlement_followup', priority: 'high', status: 'in_progress' },
    { title: '低庫存補貨：凍乾系列', type: 'inventory_issue', priority: 'urgent', status: 'todo' },
    { title: '客戶退貨處理 ORD-001', type: 'customer_service', priority: 'medium', status: 'todo' },
    { title: '聯絡北歐凍品確認交期', type: 'vendor_followup', priority: 'medium', status: 'todo' },
    { title: '6 月母親節活動素材', type: 'marketing', priority: 'high', status: 'in_progress' },
    { title: '汪汪選物所對帳差異追蹤', type: 'settlement_followup', priority: 'high', status: 'blocked' },
    { title: '門市試營運回饋整理', type: 'general', priority: 'low', status: 'todo' },
    { title: 'LINE 客服月度報表', type: 'customer_service', priority: 'low', status: 'done' },
    { title: '新品上架照片拍攝', type: 'marketing', priority: 'medium', status: 'in_progress' },
    { title: '盤點：南部倉儲', type: 'inventory_issue', priority: 'high', status: 'todo' },
    { title: '寄賣店家季度業績檢討', type: 'settlement_followup', priority: 'medium', status: 'done' },
  ];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    await prisma.task.create({
      data: {
        taskId: `TASK-${pad(i + 1)}`,
        title: t.title,
        type: t.type,
        priority: t.priority,
        status: t.status,
        dueDate: daysAgo(-randInt(0, 14)),
        assigneeId: pickOne(users).id,
        completedAt: t.status === 'done' ? daysAgo(randInt(1, 10)) : null,
      },
    });
  }

  console.log('✅ Seed 完成');
  console.log('');
  console.log('🔑 預設登入帳號（密碼皆為：furmosa2026）');
  console.log('  - admin@furmosa.com    (admin)');
  console.log('  - finance@furmosa.com  (finance)');
  console.log('  - ops@furmosa.com      (staff)');
  console.log('  - wh@furmosa.com       (warehouse)');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
