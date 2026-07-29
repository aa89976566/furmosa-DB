/**
 * 換罐 LIFF／POS 測試資料（可重跑、冪等）。
 *
 * 用法：
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/seed-refill-test-data.ts
 *
 * 或：
 *   npm run refill:seed-test
 *
 * 建立內容：
 *   - 測試店 MER-REFILL「匠寵換罐測試店」+ POS 帳號
 *   - 對照店 MER-OTHER「錯誤店家對照」（測跨店不可交付）
 *   - 會員 A（Milo，有 issued 空罐 → NT$99）
 *   - 會員 B（小花，無空罐 → NT$129）
 *   - 未來已確認預約 ×2
 *   - 固定序號：已發出／倉庫未使用
 *   - 一筆已付款待收空罐訂單（方便直接測 POS）
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { formatCustomerId, maxCustomerIdSeq } from '@/lib/customers/customer-id-format';

const POS_PASSWORD = 'furmosa2026';

const MERCHANT = {
  merchantId: 'MER-REFILL',
  name: '匠寵換罐測試店',
  city: '新北',
  posUsername: 'refilltest',
} as const;

const OTHER_MERCHANT = {
  merchantId: 'MER-OTHER',
  name: '錯誤店家對照（勿交付）',
  city: '台北',
  posUsername: 'othertest',
} as const;

/** 固定序號，方便口頭／文件對測 */
const CODES = {
  /** 會員 A 已發出、可回收 */
  issuedA1: '88001101',
  issuedA2: '88001102',
  /** 倉庫未使用，交付時綁新罐 */
  unused1: '88002201',
  unused2: '88002202',
  unused3: '88002203',
  unused4: '88002204',
} as const;

function createPrisma() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('缺少 DATABASE_URL / DIRECT_URL，無法灌測試資料');
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

function nextWeekdayAt(hour: number, minute: number, daysAhead = 3): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  // 避開週日
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function ensureMerchant(
  prisma: PrismaClient,
  input: { merchantId: string; name: string; city: string; notes: string },
) {
  const existing = await prisma.merchant.findUnique({
    where: { merchantId: input.merchantId },
  });
  if (existing) {
    await prisma.merchant.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        city: input.city,
        status: 'active',
        types: ['jar_exchange', 'partner'],
        type: 'partner',
        notes: input.notes,
      },
    });
    return existing;
  }
  return prisma.merchant.create({
    data: {
      merchantId: input.merchantId,
      name: input.name,
      city: input.city,
      type: 'partner',
      types: ['jar_exchange', 'partner'],
      status: 'active',
      contactName: '測試聯絡人',
      phone: '02-0000-0000',
      notes: input.notes,
    },
  });
}

async function ensurePosUser(
  prisma: PrismaClient,
  merchantId: string,
  username: string,
  passwordHash: string,
  displayName: string,
) {
  const existing = await prisma.merchantUser.findUnique({ where: { username } });
  if (existing) {
    await prisma.merchantUser.update({
      where: { id: existing.id },
      data: {
        merchantId,
        passwordHash,
        isActive: true,
        displayName,
      },
    });
    return existing;
  }
  return prisma.merchantUser.create({
    data: {
      merchantId,
      username,
      passwordHash,
      displayName,
      isActive: true,
    },
  });
}

async function ensureSettings(prisma: PrismaClient, merchantId: string) {
  return prisma.merchantSettings.upsert({
    where: { merchantId },
    create: {
      merchantId,
      appointmentEnabled: true,
      lineNotificationEnabled: false,
      bookingOpenTime: '09:00',
      bookingCloseTime: '18:00',
      bookingSlotMinutes: 60,
      bookingCapacityPerSlot: 3,
      bookingWeekdays: '1,2,3,4,5,6',
      waitingForJarDays: 14,
    },
    update: {
      appointmentEnabled: true,
      bookingCapacityPerSlot: 3,
    },
  });
}

async function ensureCustomer(
  prisma: PrismaClient,
  input: {
    markerPhone: string;
    name: string;
    petName: string;
    preferredCodeHint?: string;
  },
) {
  const byPhone = await prisma.customer.findFirst({
    where: { phone: input.markerPhone },
  });
  if (byPhone) {
    await prisma.customer.update({
      where: { id: byPhone.id },
      data: {
        name: input.name,
        petName: input.petName,
        petSpecies: 'dog',
        storeName: MERCHANT.name,
      },
    });
    return byPhone;
  }

  const rows = await prisma.customer.findMany({ select: { customerId: true } });
  const customerId = formatCustomerId(maxCustomerIdSeq(rows.map((r) => r.customerId)) + 1);

  return prisma.customer.create({
    data: {
      customerId,
      name: input.name,
      phone: input.markerPhone,
      type: 'individual',
      petSpecies: 'dog',
      petName: input.petName,
      petBreed: '混種',
      storeName: MERCHANT.name,
      notes: '換罐 LIFF 測試會員（seed-refill-test-data）',
    },
  });
}

async function ensureJarCode(
  prisma: PrismaClient,
  input: {
    code: string;
    status: 'unused' | 'issued';
    customerId?: string | null;
    merchantId?: string | null;
  },
) {
  const existing = await prisma.jarCode.findUnique({ where: { code: input.code } });
  const now = new Date();
  if (existing) {
    return prisma.jarCode.update({
      where: { code: input.code },
      data: {
        status: input.status,
        redeemedByCustomerId: input.status === 'issued' ? input.customerId ?? null : null,
        issuedAt: input.status === 'issued' ? now : null,
        issuedMerchantId: input.status === 'issued' ? input.merchantId ?? null : null,
        returnedAt: null,
        returnedMerchantId: null,
        lockedByRefillOrderId: null,
        batchNo: 'REFILL-TEST',
        pointValue: 1,
      },
    });
  }
  return prisma.jarCode.create({
    data: {
      code: input.code,
      status: input.status,
      batchNo: 'REFILL-TEST',
      pointValue: 1,
      redeemedByCustomerId: input.status === 'issued' ? input.customerId ?? null : null,
      issuedAt: input.status === 'issued' ? now : null,
      issuedMerchantId: input.status === 'issued' ? input.merchantId ?? null : null,
    },
  });
}

async function ensureAppointment(
  prisma: PrismaClient,
  input: {
    merchantId: string;
    customerId: string;
    petName: string;
    startsAt: Date;
    markerNote: string;
  },
) {
  const endsAt = new Date(input.startsAt.getTime() + 60 * 60 * 1000);
  const existing = await prisma.appointment.findFirst({
    where: {
      merchantId: input.merchantId,
      customerId: input.customerId,
      customerNote: input.markerNote,
    },
  });
  if (existing) {
    return prisma.appointment.update({
      where: { id: existing.id },
      data: {
        startsAt: input.startsAt,
        endsAt,
        status: 'confirmed',
        confirmedAt: new Date(),
        cancelledAt: null,
        petName: input.petName,
        serviceName: '美容＋換罐',
        isOverbooked: false,
      },
    });
  }
  return prisma.appointment.create({
    data: {
      merchantId: input.merchantId,
      customerId: input.customerId,
      serviceName: '美容＋換罐',
      petName: input.petName,
      startsAt: input.startsAt,
      endsAt,
      status: 'confirmed',
      confirmedAt: new Date(),
      createdBy: 'hq',
      customerNote: input.markerNote,
      isOverbooked: false,
    },
  });
}

async function ensureJarExchangeProduct(prisma: PrismaClient) {
  const existing = await prisma.product.findFirst({
    where: {
      OR: [{ sku: 'SKU-REFILL-TEST' }, { productId: 'PROD-REFILL' }],
    },
  });
  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data: {
        name: '換罐-雞肉凍乾（測試）',
        productCategory: 'JAR_EXCHANGE',
        status: 'active',
        price: 99,
      },
    });
  }
  return prisma.product.create({
    data: {
      productId: 'PROD-REFILL',
      sku: 'SKU-REFILL-TEST',
      name: '換罐-雞肉凍乾（測試）',
      productCategory: 'JAR_EXCHANGE',
      status: 'active',
      price: 99,
      cost: 40,
      unit: '罐',
    },
  });
}

async function ensurePaidWaitingOrder(
  prisma: PrismaClient,
  input: {
    customerId: string;
    appointmentId: string;
    merchantId: string;
    petName: string;
    productId: string;
  },
) {
  const idem = `refill-test-paid:${input.customerId}:${input.appointmentId}`;
  const existing = await prisma.refillOrder.findUnique({
    where: { idempotencyKey: idem },
  });
  if (existing) {
    return prisma.refillOrder.update({
      where: { id: existing.id },
      data: {
        status: 'paid_waiting_return',
        orderType: 'exchange',
        deliveryMode: 'exchange',
        baseAmount: 99,
        extraAmount: 0,
        totalAmount: 99,
        paidAt: new Date(),
        oldContainerSerial: null,
        newContainerSerial: null,
        completedAt: null,
        pointsAwardedAt: null,
        missingContainerNote: null,
        productId: input.productId,
        petName: input.petName,
      },
    });
  }

  const order = await prisma.refillOrder.create({
    data: {
      customerId: input.customerId,
      appointmentId: input.appointmentId,
      merchantId: input.merchantId,
      petName: input.petName,
      productId: input.productId,
      orderType: 'exchange',
      deliveryMode: 'exchange',
      baseAmount: 99,
      extraAmount: 0,
      totalAmount: 99,
      status: 'paid_waiting_return',
      paidAt: new Date(),
      idempotencyKey: idem,
    },
  });

  await prisma.paymentOrder.create({
    data: {
      refillOrderId: order.id,
      purpose: 'refill',
      provider: 'ecpay',
      merchantTradeNo: `TEST${Date.now().toString(36).toUpperCase()}`.slice(0, 20),
      amount: 99,
      status: 'paid',
      paidAt: new Date(),
      providerTradeNo: 'SEED-TEST',
    },
  });

  await prisma.refillAuditLog.create({
    data: {
      refillOrderId: order.id,
      action: 'seed_paid_waiting_order',
      actorType: 'system',
      merchantId: input.merchantId,
      success: true,
      detail: { source: 'seed-refill-test-data' },
    },
  });

  return order;
}

async function main() {
  const prisma = createPrisma();
  const passwordHash = await bcrypt.hash(POS_PASSWORD, 10);

  try {
    const merchant = await ensureMerchant(prisma, {
      ...MERCHANT,
      notes: '換罐 LIFF／POS 測試店（seed-refill-test-data）',
    });
    const other = await ensureMerchant(prisma, {
      ...OTHER_MERCHANT,
      notes: '跨店交付負向測試用',
    });

    await ensureSettings(prisma, merchant.id);
    await ensureSettings(prisma, other.id);

    await ensurePosUser(
      prisma,
      merchant.id,
      MERCHANT.posUsername,
      passwordHash,
      '換罐測試店員',
    );
    await ensurePosUser(
      prisma,
      other.id,
      OTHER_MERCHANT.posUsername,
      passwordHash,
      '對照店員',
    );

    const product = await ensureJarExchangeProduct(prisma);

    // 會員 A：有 issued 罐 → 換罐 99
    const customerA = await ensureCustomer(prisma, {
      markerPhone: '0911000001',
      name: '測試爸（Milo）',
      petName: 'Milo',
    });
    // 會員 B：無 issued → 首罐 129
    const customerB = await ensureCustomer(prisma, {
      markerPhone: '0911000002',
      name: '測試媽（小花）',
      petName: '小花',
    });

    await ensureJarCode(prisma, {
      code: CODES.issuedA1,
      status: 'issued',
      customerId: customerA.id,
      merchantId: merchant.id,
    });
    await ensureJarCode(prisma, {
      code: CODES.issuedA2,
      status: 'issued',
      customerId: customerA.id,
      merchantId: merchant.id,
    });
    for (const code of [CODES.unused1, CODES.unused2, CODES.unused3, CODES.unused4]) {
      await ensureJarCode(prisma, { code, status: 'unused' });
    }

    // 清掉 B 身上誤標的 issued（冪等）
    await prisma.jarCode.updateMany({
      where: {
        redeemedByCustomerId: customerB.id,
        status: 'issued',
        batchNo: 'REFILL-TEST',
      },
      data: {
        status: 'unused',
        redeemedByCustomerId: null,
        issuedAt: null,
        issuedMerchantId: null,
      },
    });

    // 可選：灌入時綁定 LINE，方便直接開 LIFF
    const lineA = process.env.LINE_USER_ID_A?.trim();
    const lineB = process.env.LINE_USER_ID_B?.trim();
    if (lineA?.startsWith('U')) {
      await prisma.customer.update({
        where: { id: customerA.id },
        data: { lineUserId: lineA, lineDisplay: 'Milo測試LINE' },
      });
    }
    if (lineB?.startsWith('U')) {
      await prisma.customer.update({
        where: { id: customerB.id },
        data: { lineUserId: lineB, lineDisplay: '小花測試LINE' },
      });
    }

    const apptA = await ensureAppointment(prisma, {
      merchantId: merchant.id,
      customerId: customerA.id,
      petName: 'Milo',
      startsAt: nextWeekdayAt(14, 30, 3),
      markerNote: '[refill-test] milo-exchange',
    });
    const apptB = await ensureAppointment(prisma, {
      merchantId: merchant.id,
      customerId: customerB.id,
      petName: '小花',
      startsAt: nextWeekdayAt(15, 30, 4),
      markerNote: '[refill-test] flower-first',
    });

    const paidOrder = await ensurePaidWaitingOrder(prisma, {
      customerId: customerA.id,
      appointmentId: apptA.id,
      merchantId: merchant.id,
      petName: 'Milo',
      productId: product.id,
    });

    // 店內庫存一筆，方便之後接 Reserve
    await prisma.merchantStock.upsert({
      where: {
        merchantId_productId_tierId: {
          merchantId: merchant.id,
          productId: product.id,
          tierId: '',
        },
      },
      create: {
        merchantId: merchant.id,
        productId: product.id,
        tierId: '',
        quantity: 20,
        lastRestockAt: new Date(),
      },
      update: { quantity: 20, lastRestockAt: new Date() },
    });

    console.log('✅ 換罐測試資料就緒\n');
    console.log('—— 店家 POS ——');
    console.log(`  店家：${MERCHANT.name}（${MERCHANT.merchantId}）`);
    console.log(`  帳號：${MERCHANT.posUsername}`);
    console.log(`  密碼：${POS_PASSWORD}`);
    console.log(`  路徑：/pos  → 待換罐 /pos/refill`);
    console.log('');
    console.log('—— 對照店（跨店負向）——');
    console.log(`  店家：${OTHER_MERCHANT.name}（${OTHER_MERCHANT.merchantId}）`);
    console.log(`  帳號：${OTHER_MERCHANT.posUsername} / ${POS_PASSWORD}`);
    console.log('');
    console.log('—— 會員／預約 ——');
    console.log(
      `  A ${customerA.customerId} ${customerA.name}／Milo：已確認預約、有 issued 罐 → NT$99`,
    );
    console.log(`     舊罐序號：${CODES.issuedA1}、${CODES.issuedA2}`);
    console.log(
      `  B ${customerB.customerId} ${customerB.name}／小花：已確認預約、無空罐 → NT$129`,
    );
    console.log('');
    console.log('—— 倉庫新罐（交付用）——');
    console.log(`  ${CODES.unused1} ${CODES.unused2} ${CODES.unused3} ${CODES.unused4}`);
    console.log('');
    console.log('—— POS 可直接測 ——');
    console.log(`  已付款待收空罐訂單：${paidOrder.id}`);
    console.log(`  建議流程：輸舊罐 ${CODES.issuedA1} → 新罐 ${CODES.unused1} → 完成`);
    console.log('');
    console.log('—— LIFF ——');
    console.log('  /liff/refill 需 LINE 綁定會員。可：');
    console.log('  1) HQ 後台把 lineUserId 寫到測試會員；或');
    console.log('  2) LINE_USER_ID_A=Uxxx LINE_USER_ID_B=Uyyy npm run refill:seed-test');
    console.log(`  店家 QR：/liff/refill?storeId=${MERCHANT.merchantId}`);
    if (lineA) console.log(`  已綁 A lineUserId=${lineA}`);
    if (lineB) console.log(`  已綁 B lineUserId=${lineB}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ seed-refill-test-data 失敗', e);
  process.exit(1);
});
