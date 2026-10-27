import { purchaseLineReceived } from './purchase-presentation';
import { isMadeToOrderHqProduct } from './shipment-advisory';

type Receipt = Parameters<typeof purchaseLineReceived>[2][number];
export type PendingPurchase = {
  id: string; warehouse: { code: string };
  items: { id: string; productId: string; productName: string; quantityGrams: number; unit: string }[];
  receipt: Receipt | null; receipts: Receipt[];
};

/** Partial receipts are already in on-hand stock; only the remainder is incoming. */
export function outstandingPurchaseLines(order: PendingPurchase) {
  const receipts = [...order.receipts, ...(order.receipt ? [order.receipt] : [])];
  return order.items.map(line => ({ ...line,
    remaining: Math.max(0, line.quantityGrams - purchaseLineReceived(order.id, line, receipts)),
  })).filter(line => line.remaining > 0);
}

export function incomingHqGrams(orders: PendingPurchase[]) {
  const result = new Map<string, number>();
  for (const order of orders) {
    if (order.warehouse.code !== 'WH-MAIN') continue;
    for (const line of outstandingPurchaseLines(order)) {
      if (line.unit !== 'g') continue;
      result.set(line.productId, (result.get(line.productId) ?? 0) + line.remaining);
    }
  }
  return result;
}

export type ShipmentAuditInput = {
  id: string; shipmentNumber: string; hqInventoryEligible: boolean; status: string;
  order: { status: string; fulfillmentStatus: string; paymentStatus: string } | null;
  items: { productId: string; productName: string; quantity: number; product: { sku: string; category: string } }[];
};
type Ledger = { reference: string | null; productId: string; quantity: number; eventKey: string | null };
const trackedCategories = new Set(['staple_food', 'treats', 'freeze_dried', 'health']);

/** Missing records only; does not assert that all historical quantities reconcile. */
export function missingShipmentDeductions(shipments: ShipmentAuditInput[], ledger: Ledger[]) {
  const posted = new Set(ledger.filter(row => row.eventKey && row.quantity < 0)
    .map(row => JSON.stringify([row.reference, row.productId])));
  return shipments.flatMap(shipment => {
    if (!shipment.hqInventoryEligible || !['shipped', 'delivered', 'received'].includes(shipment.status)) return [];
    const order = shipment.order;
    if (order && (['cancelled', 'returned'].includes(order.status) || order.fulfillmentStatus === 'returned' || order.paymentStatus === 'refunded')) return [];
    const missing = [...new Map(shipment.items.filter(item => item.quantity > 0 && trackedCategories.has(item.product.category)
      && !isMadeToOrderHqProduct(item.product.sku)
      && !posted.has(JSON.stringify([`shipment:${shipment.id}`, item.productId])))
      .map(item => [item.productId, item.productName])).values()];
    return missing.length ? [{ id: shipment.id, shipmentNumber: shipment.shipmentNumber, missing }] : [];
  });
}
