import { createHash } from 'node:crypto';

export type PushTier = { id: string; sku: string | null; shopifySku: string | null; shopifyVariantId: string | null;
  weightGrams: number | null; unit: string; unitQty: number; inventoryPolicy: string;
  price: number; cost: number | null; status: string };
export type PushProduct = { id: string; status: string; productCategory: string; priceTiers: PushTier[] };
export class ProductPushError extends Error {}
export function productPushFingerprint(product: PushProduct) {
  return createHash('sha256').update(JSON.stringify({ id: product.id, status: product.status, productCategory: product.productCategory,
    priceTiers: [...product.priceTiers].sort((a, b) => a.id.localeCompare(b.id)).map(t => ({
      id: t.id, status: t.status, sku: t.sku, shopifySku: t.shopifySku, shopifyVariantId: t.shopifyVariantId,
      weightGrams: t.weightGrams, price: t.price, cost: t.cost,
      unit: t.unit, unitQty: t.unitQty, inventoryPolicy: t.inventoryPolicy,
    })) })).digest('hex');
}
export function singleTierForPush(product: PushProduct) {
  if (product.status !== 'active' || product.productCategory !== 'STANDARD') throw new ProductPushError('目前只支援有效的一般單品');
  const tiers = product.priceTiers.filter(t => t.status === 'active');
  if (tiers.length !== 1) throw new ProductPushError('目前只支援單一有效規格；請先確認商品規格');
  const tier = tiers[0];
  if (!['g', '克', '公克'].includes(tier.unit) || tier.unitQty !== 1 || tier.inventoryPolicy !== 'shared') {
    throw new ProductPushError('目前只支援單份克重、共用散裝庫存的規格');
  }
  if (!/^[1-9]\d*$/.test(tier.shopifyVariantId ?? '')) throw new ProductPushError('尚未綁定 Shopify 規格，請先完成對應');
  const sku = tier.shopifySku?.trim() || tier.sku?.trim();
  if (!sku) throw new ProductPushError('缺少販售 SKU');
  if (!Number.isSafeInteger(tier.weightGrams) || tier.weightGrams! <= 0) throw new ProductPushError('缺少有效的每包克數');
  for (const value of [tier.price, tier.cost]) {
    if (value == null || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100)) || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
      throw new ProductPushError('售價與每包成本必須是有效金額，最多兩位小數');
    }
  }
  if (tier.price === 0) throw new ProductPushError('售價必須大於零');
  return { ...tier, sku, variantId: `gid://shopify/ProductVariant/${tier.shopifyVariantId}` };
}

export const PUSH_READ = `query HqProductPushRead($id: ID!) {
  shop { currencyCode }
  productVariant(id: $id) {
    id sku price product { id }
    inventoryItem { unitCost { amount currencyCode } measurement { weight { value unit } } }
  }
}`;
export const PUSH_WRITE = `mutation HqProductPush($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants, allowPartialUpdates: false) {
    productVariants { id }
    userErrors { field message }
  }
}`;

type Variant = { id: string; sku: string; price: string; product: { id: string };
  inventoryItem: { unitCost: { amount: string; currencyCode: string } | null;
    measurement: { weight: { value: number; unit: string } | null } } };

/** Exact bound variant only. Does not create, publish, rewrite content, or change stock. */
export async function pushSingleProduct(product: PushProduct, config: { domain: string; token: string }, request: typeof fetch = fetch) {
  const tier = singleTierForPush(product);
  const domain = config.domain.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) || !config.token.trim()) throw new ProductPushError('Shopify 管理 API 尚未設定');
  async function graphql(query: string, variables: object): Promise<Record<string, any>> {
    let response: Response;
    try {
      response = await request(`https://${domain}/admin/api/2026-10/graphql.json`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': config.token },
        body: JSON.stringify({ query, variables }), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
      });
    } catch { throw new ProductPushError('Shopify 連線中斷；結果需重新讀取確認，請勿連續重試'); }
    if (!response.ok) throw new ProductPushError(`Shopify 請求未完成（HTTP ${response.status}）；請重新核對結果`);
    let payload;
    try { payload = await response.json(); } catch { throw new ProductPushError('Shopify 回傳無法確認，請重新核對結果'); }
    if (!payload || typeof payload !== 'object' || payload.errors || !payload.data || typeof payload.data !== 'object') throw new ProductPushError('Shopify 回傳錯誤，請確認商品寫入權限及結果');
    return payload.data;
  }
  async function read() {
    const data = await graphql(PUSH_READ, { id: tier.variantId });
    const variant = data.productVariant as Variant | null;
    if (data.shop?.currencyCode !== 'TWD') throw new ProductPushError('此同步僅支援新台幣商店');
    if (!variant || variant.id !== tier.variantId || variant.sku !== tier.sku || !/^gid:\/\/shopify\/Product\/[1-9]\d*$/.test(variant.product?.id ?? '')) {
      throw new ProductPushError('Shopify 規格或 SKU 與 HQ 不符，已停止同步');
    }
    return variant;
  }
  function matches(variant: Variant) {
    const cost = variant.inventoryItem?.unitCost;
    const weight = variant.inventoryItem?.measurement?.weight;
    const gramsPerUnit: Record<string, number> = { GRAMS: 1, KILOGRAMS: 1000, OUNCES: 28.349523125, POUNDS: 453.59237 };
    const grams = weight ? weight.value * (gramsPerUnit[weight.unit] ?? NaN) : NaN;
    return Number(variant.price) === tier.price && cost?.currencyCode === 'TWD' && Number(cost.amount) === tier.cost && Math.abs(grams - tier.weightGrams!) < 1e-6;
  }
  const before = await read();
  if (matches(before)) return { changed: false, before, after: before };
  const data = await graphql(PUSH_WRITE, { productId: before.product.id, variants: [{
    id: tier.variantId, price: tier.price.toFixed(2),
    inventoryItem: { cost: tier.cost!.toFixed(2), measurement: { weight: { value: tier.weightGrams, unit: 'GRAMS' } } },
  }] });
  const result = data.productVariantsBulkUpdate;
  if (!result || !Array.isArray(result.userErrors) || result.userErrors.length || result.productVariants?.length !== 1 || result.productVariants[0].id !== tier.variantId) {
    throw new ProductPushError('Shopify 未確認同步成功，請檢查寫入權限並重新核對商品');
  }
  const after = await read();
  if (!matches(after)) throw new ProductPushError('Shopify 讀回結果與 HQ 不一致，請重新核對商品');
  return { changed: true, before, after };
}
