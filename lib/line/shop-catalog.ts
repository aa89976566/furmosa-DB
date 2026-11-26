export type LineShopCategory = 'treats' | 'toys' | 'gifts' | 'lifestyle' | 'all';

export type LineShopProduct = {
  id: string;
  title: string;
  handle: string;
  productType: string;
  tags: string[];
  imageUrl: string | null;
  variantId: string;
  variantTitle: string;
  price: number;
  available: boolean;
  description?: string;
};

type ShopifyProductJson = {
  id: number | string;
  title: string;
  handle: string;
  product_type?: string;
  body_html?: string;
  tags?: string[];
  images?: Array<{ src?: string }>;
  image?: { src?: string } | null;
  variants?: Array<{
    id: number | string;
    title?: string;
    price?: string | number;
    available?: boolean;
  }>;
};

type ShopifyProductsResponse = { products?: ShopifyProductJson[] };

function plainDescription(value?: string) {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

const SHOP_ORIGIN = (process.env.LINE_SHOP_URL?.trim() || 'https://furmosa.com')
  .replace(/\/collections\/.*$/, '')
  .replace(/\/$/, '');
const CACHE_TTL_MS = 5 * 60 * 1000;

let catalogCache: { expiresAt: number; products: LineShopProduct[] } | null = null;

function firstAvailableVariant(product: ShopifyProductJson) {
  const variants = product.variants ?? [];
  return (
    variants.find((variant) => variant.available !== false) ?? variants[0] ?? null
  );
}

export function normalizeShopifyProducts(
  payload: ShopifyProductsResponse,
): LineShopProduct[] {
  return (payload.products ?? []).flatMap((product) => {
    const variant = firstAvailableVariant(product);
    if (!product.handle || !variant?.id) return [];
    const price = Number(variant.price ?? 0);
    if (!Number.isFinite(price) || price < 0) return [];
    return [
      {
        id: String(product.id),
        title: product.title.trim(),
        handle: product.handle,
        productType: product.product_type?.trim() ?? '',
        tags: Array.isArray(product.tags) ? product.tags : [],
        imageUrl: product.images?.[0]?.src ?? product.image?.src ?? null,
        variantId: String(variant.id),
        variantTitle: variant.title?.trim() || '單一規格',
        price,
        available: variant.available !== false,
        description: plainDescription(product.body_html),
      } satisfies LineShopProduct,
    ];
  });
}

export function productMatchesCategory(
  product: LineShopProduct,
  category: LineShopCategory,
) {
  const productType = product.productType.toLowerCase();
  const haystack = [product.title, productType, ...product.tags].join(' ').toLowerCase();
  const isService = /服務|預約|溝通|課程|活動|體驗/.test(haystack);
  const isGift = /禮品|禮盒|吊飾|鑰匙圈|客製|畫作|藝術|聯名|蠟燭|送禮/.test(haystack);
  const isToy =
    /玩具|飛盤|拉扯|嗅聞|互動/.test(productType) ||
    /玩具|飛盤|拉扯|嗅聞/.test(haystack);
  const isLifestyle =
    /生活用品|清潔用品|洗澡用品|美容用品|外出用品|居家用品|清潔|洗澡|美容|梳|刷|碗|餐具|牽繩|胸背|外出|收納|居家/.test(haystack);
  if (category === 'all') return !isService;
  if (category === 'gifts') return !isService && isGift;
  if (category === 'toys') return !isService && isToy;
  if (category === 'lifestyle') {
    return !isService && !isGift && !isToy && isLifestyle;
  }
  return !isService && !isGift && !isToy && !isLifestyle &&
    /零食|肉乾|凍乾|潔牙|咬咬|食/.test(haystack);
}

export function getProductUrl(product: Pick<LineShopProduct, 'handle'>) {
  return `${SHOP_ORIGIN}/products/${encodeURIComponent(product.handle)}`;
}

export function getCartUrl(product: Pick<LineShopProduct, 'variantId'>) {
  return `${SHOP_ORIGIN}/cart/${encodeURIComponent(product.variantId)}:1`;
}

export function getCollectionUrl(category: LineShopCategory) {
  if (category === 'all') return `${SHOP_ORIGIN}/collections/all`;
  const query = {
    treats: '零食',
    toys: '玩具',
    gifts: '禮品',
    lifestyle: '生活用品',
  }[category];
  return `${SHOP_ORIGIN}/search?q=${encodeURIComponent(query)}&type=product`;
}

export async function listLineShopProducts(
  category: LineShopCategory,
  options: { limit?: number; forceRefresh?: boolean } = {},
) {
  const now = Date.now();
  let products = catalogCache?.products;
  if (options.forceRefresh || !products || !catalogCache || catalogCache.expiresAt <= now) {
    const response = await fetch(`${SHOP_ORIGIN}/collections/all/products.json?limit=100`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) throw new Error(`Shopify 商品讀取失敗 (${response.status})`);
    products = normalizeShopifyProducts(
      (await response.json()) as ShopifyProductsResponse,
    );
    catalogCache = { products, expiresAt: now + CACHE_TTL_MS };
  }

  return [...products]
    .filter(
      (product) => product.available && productMatchesCategory(product, category),
    )
    .sort(() => 0)
    .slice(0, options.limit ?? 8);
}

export function clearLineShopCatalogCache() {
  catalogCache = null;
}
