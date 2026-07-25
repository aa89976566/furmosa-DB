export const ORDER_PAGE_SIZE = 30;
export const SHIPMENT_QUEUE_TAKE = 60;

export function parsePage(raw: string | undefined, fallback = 1): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

/** 保留既有 query，覆寫 page */
export function hrefWithPage(
  basePath: string,
  current: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (!value || key === 'page') continue;
    params.set(key, value);
  }
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
