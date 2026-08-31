/**
 * 店家核銷一律從目前部署的 POS 登入頁進入。
 *
 * 門市由 POS 帳號決定，不接受 HQ 清單用 query string 預選，避免把交易掛錯店。
 * 使用相對路徑也可避免 Production 被 VERCEL_URL 或舊環境變數帶到 Preview 網址。
 */
const POS_REDEEM_PATH = '/pos/login';

export function buildUnifiedStoreRedeemPath(_storeSlug?: string): string {
  return POS_REDEEM_PATH;
}

export function buildUnifiedStoreRedeemUrl(storeSlug?: string): string {
  return buildUnifiedStoreRedeemPath(storeSlug);
}

/** 舊版專屬連結 → 導向統一入口並預選店家 */
export function parseStoreAccessSegment(segment: string): { slug: string; secretToken: string } | null {
  const lastDash = segment.lastIndexOf('-');
  if (lastDash <= 0) return null;
  const slug = segment.slice(0, lastDash);
  const secretToken = segment.slice(lastDash + 1);
  if (!slug || !secretToken) return null;
  return { slug, secretToken };
}

/** @deprecated 改用 buildUnifiedStoreRedeemUrl */
export function buildStoreRedeemUrl(slug: string, _secretToken?: string): string {
  return buildUnifiedStoreRedeemUrl(slug);
}
