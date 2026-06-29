'use server';

import { prisma } from '@/lib/prisma';
import {
  customerSearchWhere,
  merchantSearchWhere,
  orderSearchWhere,
  productSearchWhere,
} from '@/lib/site-search';

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
  }>;
  merchants: Array<{
    id: string;
    name: string;
    merchantId: string;
    contactName: string | null;
    phone: string | null;
  }>;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    productId: string;
  }>;
};

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
      customers,
      merchants,
      products,
    };
  } catch (e) {
    console.error('[searchDashboard]', e);
    throw new Error('搜尋失敗，請稍後再試');
  }
}
