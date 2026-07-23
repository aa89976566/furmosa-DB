/** 熱路徑快取標籤 — Data Cache（unstable_cache）與 Runtime Cache 共用 */
export const CACHE_TAGS = {
  dashboard: 'dashboard',
  merchantsPortfolio: 'merchants-portfolio',
  orderHubTotals: 'order-hub-totals',
  shipmentQueueCounts: 'shipment-queue-counts',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
