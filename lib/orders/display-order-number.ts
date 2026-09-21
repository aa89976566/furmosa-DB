import { snapshotView } from '@/lib/shopify/snapshot-view';

type OrderNumberSource = {
  orderNumber: string;
  source?: string | null;
  externalOrderName?: string | null;
  shopifySnapshot?: unknown;
};

/**
 * Human-facing order number. The stored orderNumber remains the stable HQ
 * integration key; Shopify's own name (for example #1022) is display-only.
 */
export function displayOrderNumber(order: OrderNumberSource): string {
  if (order.source !== 'shopify') return order.orderNumber;

  const shopifyName =
    order.externalOrderName?.trim() || snapshotView(order.shopifySnapshot)?.name.trim();

  return shopifyName || order.orderNumber;
}
