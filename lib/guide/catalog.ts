import { createHash } from 'node:crypto';
import type { Product } from './conversation';

export const GUIDE_CATALOG_QUERY = `query GuideCatalog($after: String) {
  products(first: 50, after: $after, query: "status:active") {
    nodes {
      id title status onlineStoreUrl
      metafields(first: 50, namespace: "furmosa") {
        nodes { key value }
        pageInfo { hasNextPage }
      }
      variants(first: 50) {
        nodes { id title sku availableForSale price }
        pageInfo { hasNextPage }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

export type CatalogRow = {
  id: string; title: string; status: string; onlineStoreUrl: string | null;
  metafields: { nodes: Array<{ key: string; value: string }>; pageInfo: { hasNextPage: boolean } };
  variants: { nodes: Array<{ id: string; title: string; sku: string | null; availableForSale: boolean; price: string }>; pageInfo: { hasNextPage: boolean } };
};
export type ReviewedRule = {
  variantId: string; sku: string; fingerprint: string; reviewedAt: string; evidenceUrls: string[];
  species: string[]; needs: string[]; category: Product['category'];
  ingredients: string[] | null; minAgeMonths: number | null; maxAgeMonths: number | null;
  verifiedClaims: string[];
};
export type CatalogIssue = { productId: string; variantId?: string; code: string };
const publicKeys = new Set(['suitable_for', 'not_suitable_for', 'food_source', 'chew_profile', 'material_details', 'dimensions', 'package_contents', 'play_guide', 'storage_and_feeding']);

// Approval is bound to this exact variant and its current public suitability
// data. Availability and price can change without manufacturing new approvals.
export function catalogFingerprint(row: CatalogRow, variantId: string): string {
  const variant = row.variants.nodes.find(v => v.id === variantId);
  if (!variant) throw new Error('UNKNOWN_VARIANT');
  const fields = row.metafields.nodes.filter(m => publicKeys.has(m.key)).sort((a, b) => a.key.localeCompare(b.key));
  return createHash('sha256').update(JSON.stringify({ productId: row.id, title: row.title, variantId, titleVariant: variant.title, sku: variant.sku, fields })).digest('hex');
}

export function mapGuideCatalog(rows: CatalogRow[], rules: ReviewedRule[], now = Date.now()) {
  const products: Array<Product & { variantId: string; price: string }> = [];
  const issues: CatalogIssue[] = [];
  const byVariant = new Map<string, ReviewedRule[]>();
  for (const rule of rules) byVariant.set(rule.variantId, [...(byVariant.get(rule.variantId) ?? []), rule]);
  for (const row of rows) {
    if (row.status !== 'ACTIVE' || !row.onlineStoreUrl) continue;
    if (row.metafields.pageInfo.hasNextPage || row.variants.pageInfo.hasNextPage) {
      issues.push({ productId: row.id, code: 'INCOMPLETE_PAGE' }); continue;
    }
    for (const variant of row.variants.nodes) {
      const fail = (code: string) => issues.push({ productId: row.id, variantId: variant.id, code });
      if (!variant.availableForSale) continue;
      const matches = byVariant.get(variant.id) ?? [];
      if (matches.length !== 1) { fail(matches.length ? 'AMBIGUOUS_REVIEW' : 'REVIEW_REQUIRED'); continue; }
      const rule = matches[0];
      if (!variant.sku || rule.sku !== variant.sku || rule.fingerprint !== catalogFingerprint(row, variant.id)) { fail('REVIEW_STALE'); continue; }
      const reviewedAt = Date.parse(rule.reviewedAt);
      const lists = [rule.species, rule.needs, rule.verifiedClaims];
      if (!Number.isFinite(reviewedAt) || reviewedAt > now || !rule.evidenceUrls.length ||
          rule.evidenceUrls.some(url => !/^https:\/\//.test(url)) ||
          lists.some(a => !Array.isArray(a) || a.some(v => typeof v !== 'string' || !v.trim())) ||
          !rule.species.length || !rule.needs.length || !['food', 'toy', 'care'].includes(rule.category) ||
          ![rule.minAgeMonths, rule.maxAgeMonths].every(a => a === null || (Number.isInteger(a) && a >= 0)) ||
          (rule.minAgeMonths !== null && rule.maxAgeMonths !== null && rule.minAgeMonths > rule.maxAgeMonths) ||
          !(rule.ingredients === null || (Array.isArray(rule.ingredients) && rule.ingredients.length > 0 && rule.ingredients.every(i => typeof i === 'string' && i.trim())))) {
        fail('INVALID_REVIEW'); continue;
      }
      const price = Number(variant.price);
      if (!Number.isFinite(price) || price < 0) { fail('INVALID_PRICE'); continue; }
      let url: URL;
      try { url = new URL(row.onlineStoreUrl); } catch { fail('INVALID_URL'); continue; }
      if (url.protocol !== 'https:' || url.hostname !== 'furmosa.com' || url.username || url.password || !url.pathname.startsWith('/products/')) { fail('INVALID_URL'); continue; }
      if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variant.id)) { fail('INVALID_VARIANT'); continue; }
      url.search = ''; url.hash = ''; url.searchParams.set('variant', variant.id.split('/').at(-1)!);
      products.push({
        id: variant.id, variantId: variant.id, price: variant.price,
        title: variant.title === 'Default Title' ? row.title : `${row.title}｜${variant.title}`,
        url: url.toString(), available: true, verified: true,
        species: [...rule.species], needs: [...rule.needs], category: rule.category,
        ingredients: rule.ingredients ? [...rule.ingredients] : null,
        minAgeMonths: rule.minAgeMonths, maxAgeMonths: rule.maxAgeMonths,
        verifiedClaims: [...rule.verifiedClaims],
      });
    }
  }
  return { products, issues, reviewPending: issues.length > 0 };
}

export async function loadGuideCatalog(config: { domain: string; token: string }, request: typeof fetch = fetch): Promise<CatalogRow[]> {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.domain) || !config.token) throw new Error('CATALOG_NOT_CONFIGURED');
  const rows: CatalogRow[] = [];
  let after: string | null = null;
  const cursors = new Set<string>();
  for (let page = 0; page < 20; page++) {
    const response = await request(`https://${config.domain}/admin/api/2026-10/graphql.json`, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': config.token },
      body: JSON.stringify({ query: GUIDE_CATALOG_QUERY, variables: { after } }),
    });
    if (!response.ok) throw new Error('CATALOG_UNAVAILABLE');
    const payload = await response.json() as { errors?: unknown; data?: { products?: { nodes: CatalogRow[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } };
    const data = payload.data?.products;
    if (payload.errors || !data || !Array.isArray(data.nodes)) throw new Error('CATALOG_INCOMPLETE');
    rows.push(...data.nodes);
    if (!data.pageInfo.hasNextPage) return rows;
    after = data.pageInfo.endCursor;
    if (!after || cursors.has(after)) throw new Error('CATALOG_INCOMPLETE');
    cursors.add(after);
  }
  throw new Error('CATALOG_LIMIT');
}
