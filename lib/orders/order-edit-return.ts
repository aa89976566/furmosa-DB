/**
 * 編輯訂單後只允許返回 HQ 內的出貨列表，避免表單值造成外部重新導向。
 */
export function safeOrderEditReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value, 'https://hq.furmosa.local');
    if (url.origin !== 'https://hq.furmosa.local') return null;
    if (url.pathname !== '/shipments') return null;

    const shipmentId = url.searchParams.get('s')?.trim();
    if (!shipmentId || !/^[a-zA-Z0-9_-]+$/.test(shipmentId)) return null;

    return `/shipments?s=${encodeURIComponent(shipmentId)}`;
  } catch {
    return null;
  }
}
