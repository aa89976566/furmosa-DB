export const ORDER_FORM_DRAFT_VERSION = 1 as const;
export const ORDER_FORM_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type StoredOrderFormDraft<T> = {
  version: typeof ORDER_FORM_DRAFT_VERSION;
  savedAt: number;
  data: T;
};

export function serializeOrderFormDraft<T>(data: T, savedAt = Date.now()): string {
  return JSON.stringify({
    version: ORDER_FORM_DRAFT_VERSION,
    savedAt,
    data,
  } satisfies StoredOrderFormDraft<T>);
}

export function parseOrderFormDraft<T>(
  raw: string | null,
  now = Date.now(),
): StoredOrderFormDraft<T> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredOrderFormDraft<T>>;
    if (value.version !== ORDER_FORM_DRAFT_VERSION) return null;
    if (!Number.isFinite(value.savedAt) || typeof value.savedAt !== 'number') return null;
    if (value.savedAt > now || now - value.savedAt > ORDER_FORM_DRAFT_MAX_AGE_MS) return null;
    if (!value.data || typeof value.data !== 'object') return null;
    return value as StoredOrderFormDraft<T>;
  } catch {
    return null;
  }
}
