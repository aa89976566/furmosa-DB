'use server';

import { prisma } from '@/lib/prisma';

export type DashboardSearchResult = {
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    customerName: string | null;
  }>;
  customers: Array<{
    id: string;
    name: string;
    customerId: string;
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
    return { orders: [], customers: [], products: [] };
  }

  const contains = { contains: q, mode: 'insensitive' as const };

  try {
  const [orders, customers, products] = await Promise.all([
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: contains },
          { customer: { name: contains } },
          { customer: { customerId: contains } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        customer: { select: { name: true } },
      },
      orderBy: { orderedAt: 'desc' },
      take: 8,
    }),
    prisma.customer.findMany({
      where: {
        OR: [{ name: contains }, { customerId: contains }, { phone: contains }],
      },
      select: { id: true, name: true, customerId: true, phone: true },
      orderBy: { name: 'asc' },
      take: 8,
    }),
    prisma.product.findMany({
      where: {
        OR: [{ name: contains }, { sku: contains }, { productId: contains }],
      },
      select: { id: true, name: true, sku: true, productId: true },
      orderBy: { name: 'asc' },
      take: 8,
    }),
  ]);

  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total,
      customerName: o.customer?.name ?? null,
    })),
    customers,
    products,
  };
  } catch (e) {
    console.error('[searchDashboard]', e);
    throw new Error('搜尋失敗，請稍後再試');
  }
}
