import { cache } from 'react';
import { prisma } from '@/lib/prisma';

// React cache is scoped to one Server Component request. A subsequent save or
// refresh reads the database again; no order/catalog data is cached across users.
export const getReviewCatalog = cache(() => prisma.product.findMany({
  where: { status: 'active' },
  select: {
    id: true, name: true, sku: true, sourceSku: true, status: true,
    unit: true, defaultTemperature: true,
    vendor: { select: { id: true, vendorId: true, name: true } },
    priceTiers: {
      where: { status: 'active' },
      select: {
        id: true, weightGrams: true, unit: true, unitQty: true, price: true,
        sku: true, shopifySku: true, shopifyVariantId: true, status: true, notes: true,
      },
    },
  },
}));

export const getLatestReviewAudit = cache((orderId: string) => prisma.statusAuditLog.findFirst({
  where: { entityType: 'oms_review', entityId: orderId },
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  select: { metadataJson: true },
}));
