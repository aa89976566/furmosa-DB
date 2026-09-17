type NameRecord = Record<string, unknown>;

const record = (value: unknown): NameRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as NameRecord)
    : {};
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const isHanName = (value: string) => /^[\p{Script=Han}·・]+$/u.test(value);

function familyFirst(firstName: unknown, lastName: unknown): string {
  const first = text(firstName);
  const last = text(lastName);
  if (!first) return last;
  if (!last) return first;
  return isHanName(first) && isHanName(last) ? `${last}${first}` : `${last} ${first}`;
}

function sourceNames(snapshot: unknown) {
  const root = record(snapshot);
  const order = record(root.order);
  const shipping = record(order.shipping_address);
  const customer = record(order.customer);
  const shippingSplit = familyFirst(shipping.first_name, shipping.last_name);
  const customerSplit = familyFirst(customer.first_name, customer.last_name);
  const canonical = shippingSplit || customerSplit || text(shipping.name);
  const aliases = [
    text(shipping.name),
    [text(shipping.first_name), text(shipping.last_name)].filter(Boolean).join(' '),
    [text(shipping.first_name), text(shipping.last_name)].filter(Boolean).join(''),
    [text(customer.first_name), text(customer.last_name)].filter(Boolean).join(' '),
    [text(customer.first_name), text(customer.last_name)].filter(Boolean).join(''),
  ].filter(Boolean);
  return { canonical, aliases };
}

/** Shopify 拆分姓名一律以台灣習慣「姓＋名」顯示。 */
export function shopifyRecipientName(snapshot: unknown): string {
  return sourceNames(snapshot).canonical;
}

/** 只修正可確認為 Shopify 舊組合的姓名；人工輸入內容保持原樣。 */
export function normalizeStoredShopifyRecipient(
  storedName: string | null | undefined,
  snapshot: unknown,
): string {
  const stored = text(storedName);
  const { canonical, aliases } = sourceNames(snapshot);
  if (!canonical) return stored;
  if (!stored) return canonical;
  const comparable = (value: string) => value.replace(/\s+/g, '').toLocaleLowerCase();
  return aliases.some((alias) => comparable(alias) === comparable(stored)) ? canonical : stored;
}
