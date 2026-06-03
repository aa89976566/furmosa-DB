/** 統一店家核銷入口（各店於頁面選擇店家） */
export function resolveMemberSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_MEMBER_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://member.furmosa.pet';
}

export function buildUnifiedStoreRedeemPath(storeSlug?: string): string {
  if (!storeSlug) return '/store-redeem';
  return `/store-redeem?store=${encodeURIComponent(storeSlug)}`;
}

export function buildUnifiedStoreRedeemUrl(storeSlug?: string): string {
  return `${resolveMemberSiteOrigin()}${buildUnifiedStoreRedeemPath(storeSlug)}`;
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
