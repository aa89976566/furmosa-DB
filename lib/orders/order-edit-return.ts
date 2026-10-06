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

/** 成功寫入後導回原頁，並附上可顯示一次的成功提示。 */
export function withOrderSavedNotice(href: string, notice: 'created' | 'updated' = 'updated') {
  const queryIndex = href.indexOf('?');
  const path = queryIndex === -1 ? href : href.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex === -1 ? '' : href.slice(queryIndex + 1));
  params.set('saved', notice);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
