'use server';

import { prisma } from '@/lib/prisma';
import {
  customerSearchWhere,
  merchantSearchWhere,
  orderSearchWhere,
  productSearchWhere,
} from '@/lib/site-search';
import {
  loadCustomerSearchInsights,
  loadMerchantSearchInsights,
  type CustomerSearchInsight,
  type MerchantSearchInsight,
} from '@/lib/search/entity-insights';

export type DashboardSearchResult = {
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    customerName: string | null;
    merchantName: string | null;
    recipientHint: string | null;
  }>;
  customers: Array<{
    id: string;
    name: string;
    customerId: string;
    phone: string | null;
    insight: CustomerSearchInsight;
  }>;
  merchants: Array<{
    id: string;
    name: string;
    merchantId: string;
    contactName: string | null;
    phone: string | null;
    insight: MerchantSearchInsight;
  }>;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    productId: string;
  }>;
};

const emptyInsightMerchant = (): MerchantSearchInsight => ({
  stockUnits: 0,
  lowStockSkus: 0,
  outOfStockSkus: 0,
  lastRestockAt: null,
  restockTxnCount90d: 0,
  jarStockUnits: 0,
  jarLowStockSkus: 0,
  jarOutOfStockSkus: 0,
});

const emptyInsightCustomer = (): CustomerSearchInsight => ({
  orderCount: 0,
  lastOrderAt: null,
  topProducts: [],
  jarPointsBalance: 0,
  jarCodesRedeemed: 0,
  lastJarRedeemAt: null,
});

export async function searchDashboard(query: string): Promise<DashboardSearchResult> {
  const q = query.trim();
  if (q.length < 1) {
    return { orders: [], customers: [], merchants: [], products: [] };
  }

  try {
    const [orders, customers, merchants, products] = await Promise.all([
      prisma.order.findMany({
        where: orderSearchWhere(q),
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          customer: { select: { name: true } },
          merchant: { select: { name: true, contactName: true } },
          shipments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { recipientName: true, recipientPhone: true },
          },
        },
        orderBy: { orderedAt: 'desc' },
        take: 8,
      }),
      prisma.customer.findMany({
        where: customerSearchWhere(q),
        select: { id: true, name: true, customerId: true, phone: true },
        orderBy: { name: 'asc' },
        take: 8,
      }),
      prisma.merchant.findMany({
        where: merchantSearchWhere(q),
        select: {
          id: true,
          name: true,
          merchantId: true,
          contactName: true,
          phone: true,
        },
        orderBy: { name: 'asc' },
        take: 8,
      }),
      prisma.product.findMany({
        where: productSearchWhere(q),
        select: { id: true, name: true, sku: true, productId: true },
        orderBy: { name: 'asc' },
        take: 8,
      }),
    ]);

    const [merchantInsights, customerInsights] = await Promise.all([
      loadMerchantSearchInsights(merchants.map((m) => m.id)),
      loadCustomerSearchInsights(customers.map((c) => c.id)),
    ]);

    return {
      orders: orders.map((o) => {
        const shipment = o.shipments[0];
        const recipientHint =
          shipment?.recipientName || shipment?.recipientPhone
            ? [shipment.recipientName, shipment.recipientPhone].filter(Boolean).join(' · ')
            : o.merchant?.contactName ?? null;
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          total: o.total,
          customerName: o.customer?.name ?? null,
          merchantName: o.merchant?.name ?? null,
          recipientHint,
        };
      }),
      customers: customers.map((c) => ({
        ...c,
        insight: customerInsights.get(c.id) ?? emptyInsightCustomer(),
      })),
      merchants: merchants.map((m) => ({
        ...m,
        insight: merchantInsights.get(m.id) ?? emptyInsightMerchant(),
      })),
      products,
    };
  } catch (e) {
    console.error('[searchDashboard]', e);
    throw new Error('搜尋失敗，請稍後再試');
  }
}
