/**
 * 中秋「牠的月餅」商品主檔（與 Shopify 官網同一款）。
 * 成本尚未進單價表，先不填，避免影響結算。
 */
export const MOONCAKE_CATALOG = {
  vendor: '匠寵',
  sourceSku: 'CK-08',
  name: '地瓜山藥雞肉月餅',
  shopifyTitle: '牠的月餅｜地瓜山藥雞肉月餅 50g',
  category: 'treats',
  unit: '顆',
  weightGrams: 50,
  price: 129,
  imageUrl:
    'https://cdn.shopify.com/s/files/1/0989/6316/1465/files/furmosa-sweet-potato-yam-chicken-mooncake-hero_7d329749-9210-4775-9927-88083c45dfa3.jpg?v=1787834174',
  notes:
    '官網「牠的月餅」50g；每售出一顆捐 NT$10 給巴克幫浪犬之家。Shopify 變體 SKU 請設為 CK-08，否則訂單無法對到 Furmosa 商品。成本待補。',
} as const;

export function mooncakePriceListRow() {
  return {
    vendor: MOONCAKE_CATALOG.vendor,
    sourceSku: MOONCAKE_CATALOG.sourceSku,
    name: MOONCAKE_CATALOG.name,
    category: MOONCAKE_CATALOG.category,
    unit: MOONCAKE_CATALOG.unit,
    prices: [
      {
        weightGrams: MOONCAKE_CATALOG.weightGrams,
        unitQty: 1,
        price: MOONCAKE_CATALOG.price,
      },
    ],
    notes: MOONCAKE_CATALOG.notes,
  };
}

export function isMooncakeSearchTerm(term: string) {
  const compact = term.replace(/\s+/g, '');
  return compact.includes('月餅') || compact.includes('牠的月餅');
}
