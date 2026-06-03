import { prisma } from '@/lib/prisma';
import { resolveOrderItemUnitCost } from '@/lib/order-item-cost';
import {
  orderTotalFromAmounts,
  resolveOrderShipping,
  shipmentCarrierFromOrder,
  SHIPPING_FEE_TYPES,
} from '@/lib/shipping-policy';

const VALID_SHIPPING_FEE_TYPES = SHIPPING_FEE_TYPES;
const VALID_PAYMENT_STATUSES_ON_CREATE = ['unpaid', 'paid', 'cod'] as const;
export const VALID_PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'cod', 'refunded'] as const;

const CUSTOMER_SOURCE_MAP: Record<string, string> = {
  social: 'website',
  line: 'line',
  consignment: 'consignment',
};

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

export type ParsedOrderLine = {
  productId: string;
  tierId: string;
  quantity: number;
  unitPrice: number;
  isGift: boolean;
  unitCost: number;
  weightGrams: number | null;
  unit: string | null;
  productName: string;
  sku: string;
  lineSubtotal: number;
};

export type ParsedOrderPayload = {
  orderType: string;
  source: string;
  customerId: string | null;
  merchantId: string | null;
  discount: number;
  note: string | null;
  shippingFeeType: string;
  paymentStatus: string;
  shippingMethod: string;
  shippingAddress: string | null;
  cvsBrand: string | null;
  cvsStoreName: string | null;
  cvsStoreId: string | null;
  recipientName: string;
  recipientPhone: string | null;
  shippingFee: number;
  companyShippingCost: number;
  shipmentCarrier: string | null;
  subtotal: number;
  giftCost: number;
  total: number;
  items: ParsedOrderLine[];
  customer: { name: string; phone: string | null; address: string | null } | null;
  shipmentRecipientAddress: string | null;
  shipmentNotes: string | null;
};

export async function parseOrderFormData(
  formData: FormData,
  opts?: { extendedPayment?: boolean },
): Promise<ParsedOrderPayload> {
  const orderType = String(formData.get('orderType') ?? '');
  if (!['merchant', 'customer'].includes(orderType)) {
    throw new Error('請選擇訂單類型');
  }

  const discount = toNumber(formData.get('discount'));
  const note = toNullableString(formData.get('note'));
  if (discount < 0) throw new Error('折扣不可為負數');

  const shippingFeeTypeRaw = String(formData.get('shippingFeeType') ?? 'unpaid');
  const shippingFeeType = (VALID_SHIPPING_FEE_TYPES as readonly string[]).includes(
    shippingFeeTypeRaw,
  )
    ? shippingFeeTypeRaw
    : 'unpaid';

  const paymentStatusRaw = String(formData.get('paymentStatus') ?? 'unpaid');
  const paymentAllowed = opts?.extendedPayment
    ? VALID_PAYMENT_STATUSES
    : VALID_PAYMENT_STATUSES_ON_CREATE;
  const paymentStatus = (paymentAllowed as readonly string[]).includes(paymentStatusRaw)
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

  const { shippingFee, companyShippingCost } = resolveOrderShipping({
    shippingFeeType,
    shippingMethod,
    cvsBrand,
  });
  const shipmentCarrier = shipmentCarrierFromOrder({ shippingMethod, cvsBrand });

  let source: string;
  let customerId: string | null = null;
  let merchantId: string | null = null;

  if (orderType === 'merchant') {
    source = 'consignment';
    merchantId = String(formData.get('merchantId') ?? '').trim();
    if (!merchantId) throw new Error('請選擇寄賣店家');
    customerId = toNullableString(formData.get('customerId'));
  } else {
    const cs = String(formData.get('customerSource') ?? '');
    if (!CUSTOMER_SOURCE_MAP[cs]) throw new Error('請選擇客戶來源（社群／LINE／寄賣）');
    source = CUSTOMER_SOURCE_MAP[cs];
    customerId = String(formData.get('customerId') ?? '').trim();
    if (!customerId) throw new Error('請選擇客戶');
    if (cs === 'consignment') {
      merchantId = toNullableString(formData.get('merchantId'));
    }
  }

  const productIds = formData.getAll('productId').map(String);
  const tierIds = formData.getAll('tierId').map(String);
  const quantities = formData.getAll('quantity').map(String);
  const unitPrices = formData.getAll('unitPrice').map(String);
  const weightGrams = formData.getAll('weightGrams').map(String);
  const units = formData.getAll('unit').map(String);
  const lineIsGifts = formData.getAll('lineIsGift').map(String);

  const rawLines = productIds
    .map((pid, idx) => {
      const wRaw = (weightGrams[idx] ?? '').trim();
      const w = wRaw === '' ? null : Number(wRaw);
      const u = (units[idx] ?? '').trim();
      const tierId = (tierIds[idx] ?? '').trim();
      const isGift = (lineIsGifts[idx] ?? '0') === '1';
      return {
        productId: pid,
        tierId,
        quantity: toInt(quantities[idx]),
        unitPrice: isGift ? 0 : toNumber(unitPrices[idx]),
        isGift,
        unitCost: 0,
        weightGrams: w != null && Number.isFinite(w) && w > 0 ? Math.round(w) : null,
        unit: u.length > 0 ? u : null,
      };
    })
    .filter((it) => it.productId && it.quantity > 0);

  if (rawLines.length === 0) {
    throw new Error('至少要有一筆商品，且數量大於 0');
  }

  const products = await prisma.product.findMany({
    where: { id: { in: rawLines.map((i) => i.productId) } },
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      price: true,
      cost: true,
      priceTiers: { select: { id: true, cost: true } },
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let giftCost = 0;
  const items: ParsedOrderLine[] = [];

  for (const it of rawLines) {
    const prod = productMap.get(it.productId);
    if (!prod) throw new Error('包含不存在的商品');
    if (it.unitPrice < 0) throw new Error('單價不可為負數');
    let unitCost = 0;
    if (it.isGift) {
      unitCost = resolveOrderItemUnitCost(prod, it.tierId || null);
      giftCost += unitCost * it.quantity;
    }
    items.push({
      ...it,
      unitCost,
      productName: prod.name,
      sku: prod.sku,
      lineSubtotal: it.unitPrice * it.quantity,
    });
  }

  const subtotal = items
    .filter((it) => !it.isGift)
    .reduce((sum, it) => sum + it.lineSubtotal, 0);
  const total = orderTotalFromAmounts(subtotal, discount, shippingFee);

  const customer = customerId
    ? await prisma.customer.findUnique({
        where: { id: customerId },
        select: { name: true, phone: true, address: true },
      })
    : null;

  const cvsAddress =
    shippingMethod === 'convenience' && cvsStoreName
      ? `${cvsBrand?.toUpperCase() ?? ''} ${cvsStoreName}`.trim()
      : null;

  const shipmentRecipientAddress =
    shippingMethod === 'convenience'
      ? (shippingAddress ?? cvsAddress)
      : (shippingAddress ?? customer?.address ?? null);

  const shipmentNotes =
    shippingMethod === 'convenience' && cvsStoreName
      ? `超商取貨：${cvsBrand?.toUpperCase() ?? ''} ${cvsStoreName}`
      : null;

  return {
    orderType,
    source,
    customerId,
    merchantId,
    discount,
    note,
    shippingFeeType,
    paymentStatus,
    shippingMethod,
    shippingAddress,
    cvsBrand,
    cvsStoreName,
    cvsStoreId,
    recipientName,
    recipientPhone,
    shippingFee,
    companyShippingCost,
    shipmentCarrier,
    subtotal,
    giftCost,
    total,
    items,
    customer,
    shipmentRecipientAddress,
    shipmentNotes,
  };
}
