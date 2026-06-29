import type { Prisma } from '@prisma/client';

/** 去除電話常見格式字元，方便比對 0983… / 983… */
export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/[\s\-().+]/g, '');
}

export function normalizeSearchInput(raw: string): string {
  return raw.trim();
}

/** 電話搜尋變體：支援有無開頭 0 */
export function phoneSearchVariants(term: string): string[] {
  const digits = normalizePhoneDigits(term);
  if (!digits || !/^\d{4,}$/.test(digits)) return [];
  const out = new Set<string>([digits]);
  if (digits.startsWith('0') && digits.length > 1) out.add(digits.slice(1));
  else if (digits.length >= 9 && digits.length <= 10) out.add(`0${digits}`);
  return [...out];
}

export function textContains(term: string): Prisma.StringFilter {
  return { contains: term.trim(), mode: 'insensitive' };
}

function appendPhoneContains(
  target: Prisma.OrderWhereInput[],
  variants: string[],
  build: (filter: Prisma.StringFilter) => Prisma.OrderWhereInput,
) {
  for (const v of variants) {
    if (!v) continue;
    target.push(build(textContains(v)));
  }
}

/** 訂單：編號、客戶、店家、收件人、電話、門市、品項、備註… */
export function orderSearchWhere(term: string): Prisma.OrderWhereInput | undefined {
  const q = normalizeSearchInput(term);
  if (!q) return undefined;

  const contains = textContains(q);
  const phoneVars = phoneSearchVariants(q);

  const or: Prisma.OrderWhereInput[] = [
    { orderNumber: contains },
    { note: contains },
    { shippingAddress: contains },
    { cvsStoreName: contains },
    { cvsStoreId: contains },
    { customer: { name: contains } },
    { customer: { customerId: contains } },
    { customer: { phone: contains } },
    { customer: { email: contains } },
    { customer: { lineDisplay: contains } },
    { customer: { address: contains } },
    { merchant: { name: contains } },
    { merchant: { merchantId: contains } },
    { merchant: { contactName: contains } },
    { merchant: { phone: contains } },
    { merchant: { email: contains } },
    { merchant: { pickupStoreName: contains } },
    { merchant: { address: contains } },
    { merchant: { city: contains } },
    {
      shipments: {
        some: {
          OR: [
            { shipmentNumber: contains },
            { trackingNumber: contains },
            { recipientName: contains },
            { recipientPhone: contains },
            { recipientAddress: contains },
            { notes: contains },
            { carrier: contains },
          ],
        },
      },
    },
    {
      items: {
        some: {
          OR: [{ productName: contains }, { sku: contains }],
        },
      },
    },
  ];

  appendPhoneContains(or, phoneVars, (filter) => ({ customer: { phone: filter } }));
  appendPhoneContains(or, phoneVars, (filter) => ({ merchant: { phone: filter } }));
  appendPhoneContains(or, phoneVars, (filter) => ({
    shipments: { some: { recipientPhone: filter } },
  }));

  return { OR: or };
}

export function customerSearchWhere(term: string): Prisma.CustomerWhereInput | undefined {
  const q = normalizeSearchInput(term);
  if (!q) return undefined;

  const contains = textContains(q);
  const phoneVars = phoneSearchVariants(q);

  const or: Prisma.CustomerWhereInput[] = [
    { name: contains },
    { customerId: contains },
    { phone: contains },
    { email: contains },
    { lineDisplay: contains },
    { address: contains },
    { preferredCvsStoreName: contains },
    { petName: contains },
  ];

  for (const v of phoneVars) {
    or.push({ phone: textContains(v) });
  }

  return { OR: or };
}

export function merchantSearchWhere(term: string): Prisma.MerchantWhereInput | undefined {
  const q = normalizeSearchInput(term);
  if (!q) return undefined;

  const contains = textContains(q);
  const phoneVars = phoneSearchVariants(q);

  const or: Prisma.MerchantWhereInput[] = [
    { name: contains },
    { merchantId: contains },
    { contactName: contains },
    { phone: contains },
    { email: contains },
    { pickupStoreName: contains },
    { address: contains },
    { city: contains },
    { notes: contains },
  ];

  for (const v of phoneVars) {
    or.push({ phone: textContains(v) });
  }

  return { OR: or };
}

export function shipmentSearchWhere(term: string): Prisma.ShipmentWhereInput | undefined {
  const q = normalizeSearchInput(term);
  if (!q) return undefined;

  const contains = textContains(q);
  const phoneVars = phoneSearchVariants(q);

  const or: Prisma.ShipmentWhereInput[] = [
    { shipmentNumber: contains },
    { trackingNumber: contains },
    { recipientName: contains },
    { recipientPhone: contains },
    { recipientAddress: contains },
    { notes: contains },
    { carrier: contains },
    { merchant: { name: contains } },
    { merchant: { contactName: contains } },
    { merchant: { phone: contains } },
    { merchant: { pickupStoreName: contains } },
    { customer: { name: contains } },
    { customer: { phone: contains } },
    { order: { orderNumber: contains } },
  ];

  for (const v of phoneVars) {
    or.push({ recipientPhone: textContains(v) });
    or.push({ merchant: { phone: textContains(v) } });
    or.push({ customer: { phone: textContains(v) } });
  }

  return { OR: or };
}

export function productSearchWhere(term: string): Prisma.ProductWhereInput | undefined {
  const q = normalizeSearchInput(term);
  if (!q) return undefined;

  const contains = textContains(q);
  return {
    OR: [
      { name: contains },
      { sku: contains },
      { productId: contains },
      { sourceSku: contains },
      { style: contains },
      { vendor: { name: contains } },
    ],
  };
}

export function subscriptionSearchWhere(term: string): Prisma.SubscriptionWhereInput | undefined {
  const q = normalizeSearchInput(term);
  if (!q) return undefined;

  const contains = textContains(q);
  const phoneVars = phoneSearchVariants(q);

  const or: Prisma.SubscriptionWhereInput[] = [
    { subscriptionNo: contains },
    { recipientName: contains },
    { recipientPhone: contains },
    { shippingAddress: contains },
    { customer: { name: contains } },
    { customer: { customerId: contains } },
    { customer: { phone: contains } },
    { plan: { name: contains } },
  ];

  for (const v of phoneVars) {
    or.push({ recipientPhone: textContains(v) });
    or.push({ customer: { phone: textContains(v) } });
  }

  return { OR: or };
}

/** 合併既有 where 與全文搜尋條件 */
export function mergeSearchWhere<T extends Record<string, unknown>>(
  base: T,
  searchClause: Record<string, unknown> | undefined,
): T {
  if (!searchClause) return base;
  const and = Array.isArray(base.AND) ? [...base.AND] : base.AND ? [base.AND] : [];
  return { ...base, AND: [...and, searchClause] };
}
