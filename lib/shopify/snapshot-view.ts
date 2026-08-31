/** Safe browser/server projection: never render arbitrary raw snapshot JSON. */
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const text = (value: unknown) => typeof value === 'string' ? value : '';
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
        quantity: typeof row.quantity === 'number' ? row.quantity : null, price: text(row.price) };
    }),
  };
}
