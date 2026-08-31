/** Safe browser/server projection: never render arbitrary raw snapshot JSON. */
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const text = (value: unknown) => typeof value === 'string' ? value : '';

/** Exact decimal display only; never used to charge or change order totals. */
export function sourceLineTotal(price: unknown, quantity: unknown): string | null {
  if (typeof price !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(price)
    || typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 0) return null;
  const [whole, fraction = ''] = price.split('.');
  const cents = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * BigInt(quantity);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

/** OMS approval and physical shipment creation are separate milestones. */
export function omsShipmentNotice(status: string | null, shipmentCount: number): string | null {
  if (!status || shipmentCount > 0) return null;
  if (status === 'NEW' || status === 'REVIEW') return '尚未審核出貨';
  if (status === 'READY') return '已審核，尚未建立出貨單';
  return '尚無 HQ 出貨單，請核對物流';
}
export function snapshotView(value: unknown) {
  const snapshot = object(value);
  if (snapshot.schemaVersion !== 1) return null;
  const order = object(snapshot.order);
  const shipping = object(order.shipping_address);
  const customer = object(order.customer);
  return {
    name: text(order.name), currency: text(order.currency),
    total: text(order.total_price),
    recipient: text(shipping.name) || [text(customer.first_name), text(customer.last_name)].filter(Boolean).join(' '),
    phone: text(shipping.phone) || text(order.phone) || text(customer.phone),
    address: ['zip', 'province', 'city', 'address1', 'address2'].map(key => text(shipping[key])).filter(Boolean).join(' '),
    items: (Array.isArray(order.line_items) ? order.line_items : []).map(value => {
      const row = object(value);
      return { title: text(row.title) || '未命名商品', sku: text(row.sku),
        quantity: typeof row.quantity === 'number' ? row.quantity : null, price: text(row.price), lineTotal: sourceLineTotal(row.price, row.quantity) };
    }),
  };
}
