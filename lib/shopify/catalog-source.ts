import type { ShopifyCatalogProduct } from './catalog-sync';

const CATALOG_QUERY = `query CatalogProducts($first: Int!, $after: String) {
  products(first: $first, after: $after, sortKey: ID) {
    nodes {
      id
      title
      status
      variants(first: 100) {
        nodes { id title sku price }
        pageInfo { hasNextPage endCursor }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

type CatalogResponse = {
  data?: {
    products?: {
      nodes?: Array<{
        id?: unknown;
        title?: unknown;
        status?: unknown;
        variants?: {
          nodes?: Array<{ id?: unknown; title?: unknown; sku?: unknown; price?: unknown }>;
          pageInfo?: { hasNextPage?: unknown };
        };
      }>;
      pageInfo?: { hasNextPage?: unknown; endCursor?: unknown };
    };
  };
  errors?: unknown;
};

export class CatalogSourceError extends Error {}

function requiredText(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new CatalogSourceError(`Shopify ${field} 資料不完整`);
  return value.trim();
}

function productStatus(value: unknown): ShopifyCatalogProduct['status'] {
  if (value === 'ACTIVE' || value === 'DRAFT' || value === 'ARCHIVED') return value;
  throw new CatalogSourceError('Shopify 商品狀態不完整');
}

export async function fetchShopifyCatalog(
  config: { domain: string; token: string },
  request: typeof fetch = fetch,
): Promise<ShopifyCatalogProduct[]> {
  const domain = config.domain.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) || !config.token.trim()) {
    throw new CatalogSourceError('尚未設定 Shopify 管理 API 網域與 read_products 憑證');
  }

  const products: ShopifyCatalogProduct[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    let response: Response;
    try {
      response = await request(`https://${domain}/admin/api/2026-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Shopify-Access-Token': config.token,
        },
        body: JSON.stringify({ query: CATALOG_QUERY, variables: { first: 100, after } }),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new CatalogSourceError('Shopify 商品讀取逾時或連線失敗；HQ 尚未修改');
    }
    if (response.status === 429) throw new CatalogSourceError('Shopify 暫時限制讀取頻率；HQ 尚未修改');
    if (response.status === 401 || response.status === 403) {
      throw new CatalogSourceError('Shopify read_products 授權不足；HQ 尚未修改');
    }
    if (!response.ok) throw new CatalogSourceError(`Shopify 商品讀取失敗（HTTP ${response.status}）；HQ 尚未修改`);

    const payload = await response.json() as CatalogResponse;
    if (payload.errors || !payload.data?.products) throw new CatalogSourceError('Shopify 商品回傳不完整；HQ 尚未修改');
    for (const row of payload.data.products.nodes ?? []) {
      if (row.variants?.pageInfo?.hasNextPage) {
        throw new CatalogSourceError(`商品「${String(row.title ?? '')}」超過 100 個規格，需先擴充分頁再同步`);
      }
      products.push({
        id: requiredText(row.id, 'product id'),
        title: requiredText(row.title, 'title'),
        status: productStatus(row.status),
        variants: (row.variants?.nodes ?? []).map((variant) => {
          const price = Number(variant.price);
          if (!Number.isFinite(price) || price < 0) throw new CatalogSourceError('Shopify variant price 資料不完整');
          return {
            id: requiredText(variant.id, 'variant id'),
            title: requiredText(variant.title, 'variant title'),
            sku: typeof variant.sku === 'string' && variant.sku.trim() ? variant.sku.trim() : null,
            price,
          };
        }),
      });
    }
    const info = payload.data.products.pageInfo;
    if (!info?.hasNextPage) return products;
    after = requiredText(info.endCursor, 'page cursor');
  }
  throw new CatalogSourceError('Shopify 商品超過同步安全上限（2,000 項）；HQ 尚未修改');
}
