const SYSTEM_SYNC_NOTE = /^Shopify [^\\n]+\\n訂單已同步，(?:門市資料待確認|待客服審核)$/;

export function customerDeliveryNote(note: string | null | undefined): string | null {
  const value = note?.trim() || null;
  if (!value || SYSTEM_SYNC_NOTE.test(value)) return null;
  return value;
}
