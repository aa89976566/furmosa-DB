export const SOURCE_ORDER_PREFIX = {
  shopify: 'SHOPIFY-',
  line: 'LINE-',
} as const;

export function formatSourceOrderNumber(prefix: string, sequence: number) {
  return `${prefix}${String(sequence).padStart(2, '0')}`;
}

export function nextSourceOrderNumber(prefix: string, lastOrderNumber?: string | null) {
  if (!lastOrderNumber?.startsWith(prefix)) return formatSourceOrderNumber(prefix, 1);
  const current = Number(lastOrderNumber.slice(prefix.length));
  return formatSourceOrderNumber(prefix, Number.isSafeInteger(current) && current > 0 ? current + 1 : 1);
}
