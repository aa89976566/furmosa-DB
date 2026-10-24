export const GIFT_CARD_FEE_VARIANT_ID = '64947813745017';
export const GIFT_CARD_PROPERTY_NAMES = ['贈送方式', '收禮毛友', '小卡內容'] as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

/** The exact Shopify add-on variant is a fee, never a physical fulfillment line. */
export function isGiftCardFeeLine(value: unknown): boolean {
  const raw = record(value).variant_id;
  if (typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0) return String(raw) === GIFT_CARD_FEE_VARIANT_ID;
  if (typeof raw !== 'string') return false;
  const text = raw.trim();
  const id = text.includes('gid://') ? (text.split('/').pop() ?? '') : text;
  return id === GIFT_CARD_FEE_VARIANT_ID;
}
