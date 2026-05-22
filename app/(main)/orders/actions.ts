'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const pad = (n: number, width = 3) => String(n).padStart(width, '0');

function ymd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function nextOrderNumber() {
  const prefix = `ORD-${ymd()}-`;
  const last = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
  });
  const seq = last ? Number(last.orderNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 3)}`;
}

async function nextShipmentNumber() {
  const prefix = `SHP-${ymd()}-`;
  const last = await prisma.shipment.findFirst({
    where: { shipmentNumber: { startsWith: prefix } },
    orderBy: { shipmentNumber: 'desc' },
  });
  const seq = last ? Number(last.shipmentNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 4)}`;
}

const VALID_SHIPPING_FEE_TYPES = ['free', 'prepaid', 'unpaid', 'cod'] as const;
const VALID_PAYMENT_STATUSES_ON_CREATE = ['unpaid', 'paid', 'cod'] as const;

function toNullableString(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function toNumber(v: FormDataEntryValue | string | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : fallback;
}

function toInt(v: FormDataEntryValue | string | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

// 客戶來源 → source 欄位 對應
const CUSTOMER_SOURCE_MAP: Record<string, string> = {
  social: 'website', // 社群（IG/FB 等網路通路統一存 'website'）
  line: 'line',
  consignment: 'consignment',
};

export async function createOrder(formData: FormData) {
  const orderType = String(formData.get('orderType') ?? '');
  if (!['merchant', 'customer'].includes(orderType)) {
    throw new Error('請選擇訂單類型');
  }

  // 共用欄位
  const discount = toNumber(formData.get('discount'));
  let shippingFee = toNumber(formData.get('shippingFee'));
  const note = toNullableString(formData.get('note'));
  if (discount < 0) throw new Error('折扣不可為負數');
  if (shippingFee < 0) throw new Error('運費不可為負數');

  // 運費類型：free 包郵 / prepaid 已付費 / unpaid 不包郵（買家於此單付運費） / cod 貨到付款（運費隨貨）
  const shippingFeeTypeRaw = String(formData.get('shippingFeeType') ?? 'unpaid');
  const shippingFeeType = (VALID_SHIPPING_FEE_TYPES as readonly string[]).includes(
    shippingFeeTypeRaw,
  )
    ? shippingFeeTypeRaw
    : 'unpaid';

  // 包郵 / 已付費：訂單上不再記運費（不計入 total）
  if (shippingFeeType === 'free' || shippingFeeType === 'prepaid') {
    shippingFee = 0;
  }

  // 付款狀態（建立時就能設定）
  const paymentStatusRaw = String(formData.get('paymentStatus') ?? 'unpaid');
  const paymentStatus = (VALID_PAYMENT_STATUSES_ON_CREATE as readonly string[]).includes(
    paymentStatusRaw,
  )
    ? paymentStatusRaw
    : 'unpaid';

  const shippingMethodRaw = String(formData.get('shippingMethod') ?? 'home');
  const shippingMethod = shippingMethodRaw === 'convenience' ? 'convenience' : 'home';
  let shippingAddress = toNullableString(formData.get('shippingAddress'));
  let cvsBrand = toNullableString(formData.get('cvsBrand'));
  let cvsStoreName = toNullableString(formData.get('cvsStoreName'));
  const recipientName = String(formData.get('recipientName') ?? '').trim();
  const recipientPhone = toNullableString(formData.get('recipientPhone'));

  if (!recipientName) throw new Error('請填寫收件人姓名');

  if (shippingMethod === 'convenience') {
    const validBrands = ['711', 'familymart', 'hilife'];
    if (!cvsBrand || !validBrands.includes(cvsBrand)) {
      throw new Error('超商取貨請選擇品牌（7-ELEVEN / 全家 / 萊爾富）');
    }
    if (!cvsStoreName) throw new Error('請填寫門市名稱');
  } else {
    cvsBrand = null;
    cvsStoreName = null;
  }
  const cvsStoreId = null;

  // 訂單來源 + 客戶/店家
  let source: string;
  let customerId: string | null = null;
  let merchantId: string | null = null;

  if (orderType === 'merchant') {
    source = 'consignment';
    merchantId = String(formData.get('merchantId') ?? '').trim();
    if (!merchantId) throw new Error('請選擇寄賣店家');
    // 寄賣店訂單可以選填客戶（誰買的）
    customerId = toNullableString(formData.get('customerId'));
  } else {
    const cs = String(formData.get('customerSource') ?? '');
    if (!CUSTOMER_SOURCE_MAP[cs]) throw new Error('請選擇客戶來源（社群／LINE／寄賣）');
    source = CUSTOMER_SOURCE_MAP[cs];
    customerId = String(formData.get('customerId') ?? '').trim();
    if (!customerId) throw new Error('請選擇客戶');
    // 客戶若是「透過寄賣店」買的，可選填寄賣店
    if (cs === 'consignment') {
      merchantId = toNullableString(formData.get('merchantId'));
    }
  }

  // 解析商品 line items（含規格資訊：weightGrams / unit）
  const productIds = formData.getAll('productId').map(String);
  const quantities = formData.getAll('quantity').map(String);
  const unitPrices = formData.getAll('unitPrice').map(String);
  const weightGrams = formData.getAll('weightGrams').map(String);
  const units = formData.getAll('unit').map(String);

  const items = productIds
    .map((pid, idx) => {
      const wRaw = (weightGrams[idx] ?? '').trim();
      const w = wRaw === '' ? null : Number(wRaw);
      const u = (units[idx] ?? '').trim();
      return {
        productId: pid,
        quantity: toInt(quantities[idx]),
        unitPrice: toNumber(unitPrices[idx]),
        weightGrams: w != null && Number.isFinite(w) && w > 0 ? Math.round(w) : null,
        unit: u.length > 0 ? u : null,
      };
    })
    .filter((it) => it.productId && it.quantity > 0);

  if (items.length === 0) throw new Error('至少要有一筆商品，且數量大於 0');

  // 撈商品名稱/SKU/重量/單位，避免依賴 client 端傳
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, name: true, sku: true, unit: true, price: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const it of items) {
    if (!productMap.has(it.productId)) {
      throw new Error('包含不存在的商品');
    }
    if (it.unitPrice < 0) throw new Error('單價不可為負數');
  }

  const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const total = Math.max(0, subtotal - discount + shippingFee);

  // 預先撈客戶資料：之後要同步到 Shipment 收件人
  const customer = customerId
    ? await prisma.customer.findUnique({
        where: { id: customerId },
        select: { name: true, phone: true, address: true },
      })
    : null;

  // 用 transaction 確保 Order + OrderItem + Shipment 一起成功
  const orderNumber = await nextOrderNumber();
  const shipmentNumber = await nextShipmentNumber();

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        source,
        status: 'draft',
        paymentStatus,
        shippingFeeType,
        fulfillmentStatus: 'pending',
        customerId,
        merchantId,
        subtotal,
        discount,
        shippingFee,
        total,
        shippingMethod,
        shippingAddress,
        cvsBrand,
        cvsStoreId,
        cvsStoreName,
        note,
        orderedAt: new Date(),
        items: {
          create: items.map((it) => {
            const prod = productMap.get(it.productId)!;
            return {
              productId: it.productId,
              productName: prod.name,
              sku: prod.sku,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              subtotal: it.unitPrice * it.quantity,
              // 規格資訊：若使用者選了規格 tier，會傳重量 / 單位；否則退回商品基礎 unit
              weightGrams: it.weightGrams,
              unit: it.unit ?? prod.unit,
            };
          }),
        },
      },
      include: { items: true },
    });

    // 建立出貨單 → 出貨隊列（客戶訂單與寄賣店家訂單皆會建立）
    const cvsAddress =
      shippingMethod === 'convenience' && cvsStoreName
        ? `${cvsBrand?.toUpperCase() ?? ''} ${cvsStoreName}`.trim()
        : null;

    await tx.shipment.create({
      data: {
        shipmentNumber,
        type: 'customer_order',
        status: 'pending',
        merchantId,
        customerId,
        orderId: order.id,
        recipientName,
        recipientPhone: recipientPhone ?? customer?.phone ?? null,
        recipientAddress:
          shippingMethod === 'convenience'
            ? (shippingAddress ?? cvsAddress)
            : (shippingAddress ?? customer?.address ?? null),
        notes:
          shippingMethod === 'convenience' && cvsStoreName
            ? `超商取貨：${cvsBrand?.toUpperCase() ?? ''} ${cvsStoreName}`
            : null,
        items: {
          create: order.items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            quantity: it.quantity,
            weightGrams: it.weightGrams,
            unit: it.unit,
          })),
        },
      },
    });

    return order;
  });

  revalidatePath('/orders');
  revalidatePath('/shipments');
  revalidatePath('/dashboard');
  if (merchantId) revalidatePath(`/merchants/${merchantId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
  redirect(`/orders/${created.id}`);
}

// ---------- 訂單詳細頁：快速更新付款 / 運費類型 ----------

const VALID_PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'cod', 'refunded'] as const;

export async function updateOrderPaymentStatus(formData: FormData) {
  const orderId = String(formData.get('orderId') ?? '');
  const next = String(formData.get('paymentStatus') ?? '');
  if (!orderId) throw new Error('缺少訂單');
  if (!(VALID_PAYMENT_STATUSES as readonly string[]).includes(next)) {
    throw new Error('付款狀態錯誤');
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: next },
  });
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/dashboard');
}

export async function updateOrderShippingFeeType(formData: FormData) {
  const orderId = String(formData.get('orderId') ?? '');
  const next = String(formData.get('shippingFeeType') ?? '');
  if (!orderId) throw new Error('缺少訂單');
  if (!(VALID_SHIPPING_FEE_TYPES as readonly string[]).includes(next)) {
    throw new Error('運費類型錯誤');
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { subtotal: true, discount: true, shippingFee: true },
  });
  if (!order) throw new Error('訂單不存在');

  // 切換為包郵 / 已付費時，shippingFee 歸 0 並重算 total
  let nextShippingFee = Number(order.shippingFee);
  if (next === 'free' || next === 'prepaid') nextShippingFee = 0;
  const total = Math.max(
    0,
    Number(order.subtotal) - Number(order.discount) + nextShippingFee,
  );

  await prisma.order.update({
    where: { id: orderId },
    data: { shippingFeeType: next, shippingFee: nextShippingFee, total },
  });
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
}
