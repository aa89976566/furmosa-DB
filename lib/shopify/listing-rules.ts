import type { ShopifyCatalogProduct } from './catalog-sync';

export const LISTING_RULES_VERSION = 'furmosa-listing-v1';
type Kind = 'food' | 'accessory' | 'service' | 'bundle';
// Controlled productType values only; never infer kind from a marketing title.
const KIND_BY_TYPE: Record<string, Kind> = {
  食品: 'food', 零食: 'food', 凍乾: 'food', 寵物零食: 'food',
  玩具: 'accessory', 用品: 'accessory', 照護用品: 'accessory', 吊飾: 'accessory', 手作黏土吊飾: 'accessory',
  服務: 'service', 組合: 'bundle',
};
const REQUIRED: Record<Kind, Array<[string, string]>> = {
  food: [['furmosa.food_source', '食材資料'], ['furmosa.storage_and_feeding', '保存與餵食'], ['furmosa.package_contents', '內容物與數量']],
  accessory: [['furmosa.material_details', '材質'], ['furmosa.dimensions', '尺寸'], ['furmosa.package_contents', '內容物與數量'], ['furmosa.play_guide', '用途'], ['furmosa.cleaning_care', '清潔保養']],
  service: [], bundle: [],
};

/** Read-only completeness checks, not verification of claims or permission to publish. */
export function checkListingRules(product: ShopifyCatalogProduct, catalog: ShopifyCatalogProduct[]) {
  const issues: Array<{ code: string; field: string; message: string; variantId?: string }> = [];
  const add = (code: string, field: string, message: string, variantId?: string) => issues.push({ code, field, message, ...(variantId ? { variantId } : {}) });
  const content = product.content;
  const kind = content ? KIND_BY_TYPE[content.productType.trim()] : undefined;
  if (!kind) add('TYPE_REQUIRED', 'productType', '請選擇已定義的商品類型，才能套用對應上架規則');
  if (!content?.description.trim()) add('DESCRIPTION_REQUIRED', 'description', '補上顧客需要的商品介紹');
  if (!content?.imageUrl) add('IMAGE_REQUIRED', 'featuredMedia', '補上商品主圖');
  if (!product.variants.length) add('VARIANT_REQUIRED', 'variants', '至少需要一個販售規格');
  for (const variant of product.variants) {
    const sku = variant.sku?.trim().toUpperCase();
    if (!sku) add('SKU_REQUIRED', 'sku', '每個販售規格需要唯一 SKU', variant.id);
    else if (catalog.flatMap(row => row.variants).filter(row => row.sku?.trim().toUpperCase() === sku).length > 1) {
      add('SKU_DUPLICATE', 'sku', `SKU ${sku} 重複，請處理對應衝突`, variant.id);
    }
    if (!Number.isFinite(variant.price) || variant.price < 0) add('PRICE_INVALID', 'price', '確認有效售價', variant.id);
  }
  if (kind && content) for (const [field, label] of REQUIRED[kind]) {
    if (!content.fields[field]?.trim()) add('FIELD_REQUIRED', field, `補上${label}`);
  }
  // Service and bundle need a separate operational contract before automatic creation.
  if (kind === 'service' || kind === 'bundle') add('SPECIAL_FLOW_REQUIRED', 'productType', '請確認服務履約或組合組成規則後，再開放自動建檔');
  return { rulesVersion: LISTING_RULES_VERSION, status: issues.length ? 'needs_attention' as const : 'fields_complete' as const, issues };
}
