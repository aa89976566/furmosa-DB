/**
 * CDN／邊緣快取標頭策略（對齊「最快網站」的 Cache HIT 模式）
 *
 * 公開可快取 HTML：s-maxage 讓 Vercel CDN 命中（x-vercel-cache: HIT）
 * 靜態資產：immutable 長期快取
 * 認證後台：不在此設 public cache（由 page 的 dynamic／private 控制）
 */

export const CDN_PUBLIC_HTML =
  'public, s-maxage=60, stale-while-revalidate=600';

export const CDN_PUBLIC_HTML_LONG =
  'public, s-maxage=3600, stale-while-revalidate=86400';

export const CDN_IMMUTABLE_ASSET =
  'public, max-age=31536000, immutable';

export const CDN_SHORT_ASSET =
  'public, max-age=86400, stale-while-revalidate=604800';
