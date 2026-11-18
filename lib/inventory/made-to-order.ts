import { bulkConsumption, type BulkTier } from './bulk';
import { isMadeToOrderHqProduct } from './shipment-advisory';

type Line = { productId: string; productName: string; quantity: number; weightGrams: number | null;
  variantKey: string | null; product: { sku: string; unit: string; priceTiers: BulkTier[] } };
export type ProductionOrder = { id: string; orderNumber: string; status: string; paymentStatus: string;
  fulfillmentStatus: string; omsStatus: string | null; deletedAt: Date | null; items: Line[];
  shipments: { status: string; items: Line[] }[] };

/** Read-only unshipped finished-product demand. This is not a raw-ingredient recipe or production completion ledger. */
export function madeToOrderDemand(orders: ProductionOrder[], truncated = false) {
  const rows: { orderId: string; orderNumber: string; productId: string; name: string; grams: number | null;
    reviewRequired: boolean; paymentStatus: string; issue: string | null }[] = [];
  for (const order of orders) {
    if (order.deletedAt || order.status === 'cancelled' || order.paymentStatus === 'refunded' ||
      !['pending', 'packed'].includes(order.fulfillmentStatus) || (order.status === 'draft' && !order.omsStatus)) continue;
    const products = new Map<string, { name: string; grams: number; issue: string | null }>();
    for (const line of order.items) {
      if (!isMadeToOrderHqProduct(line.product.sku)) continue;
      const current = products.get(line.productId) ?? { name: line.productName, grams: 0, issue: null };
      try { current.grams += bulkConsumption(line.product, line);
        if (!Number.isSafeInteger(current.grams)) throw new Error('OVERFLOW');
      } catch { current.issue = '規格或克數待核對'; }
      products.set(line.productId, current);
    }
    // Linked shipments are subtracted, never counted as another order. Cancelled/packed shipments are not shipped.
    for (const shipment of order.shipments) {
      if (!['shipped', 'delivered', 'received'].includes(shipment.status)) continue;
      for (const line of shipment.items) {
        const current = products.get(line.productId);
        if (!current) continue;
        try { current.grams -= bulkConsumption(line.product, line); }
        catch { current.issue = '已出貨規格待核對'; }
      }
    }
    for (const [productId, current] of products) {
      if (current.grams < 0) current.issue = '已出貨量超過訂購量，請核對';
      if (!current.issue && current.grams === 0) continue;
      rows.push({ orderId: order.id, orderNumber: order.orderNumber, productId, name: current.name,
        grams: current.issue ? null : current.grams, reviewRequired: Boolean(order.omsStatus && order.omsStatus !== 'READY'),
        paymentStatus: order.paymentStatus, issue: current.issue });
    }
  }
  return { rows, complete: !truncated && !rows.some(row => row.issue), limit: 500 };
}
