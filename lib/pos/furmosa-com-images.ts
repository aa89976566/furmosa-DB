import catalog from '@/lib/pos/data/furmosa-com-products.json';

export type FurmosaComProductImage = {
  title: string;
  handle: string;
  imageUrl: string;
};

const PRODUCTS = catalog as FurmosaComProductImage[];

const ALIASES: Record<string, string> = {
  雞霸: '壕大大雞霸',
  原味雞霸: '壕大大雞霸',
  混合蔬果凍乾: '混蔬菜凍乾',
  混合蔬果: '混蔬菜',
  牛肉地瓜乾: '牛肉地瓜',
  雞肉南瓜乾: '雞肉南瓜',
  鴨喉嚨: '鴨喉',
  鴨脖子: '鴨脖凍乾',
  豬耳片: '豬耳朵片',
  豬耳條: '豬耳朵條',
};

export function normalizeFurmosaProductName(name: string) {
  return name
    .replace(/[◈]/g, ' ')
    .replace(/[｜|·・,，.\-—_/]/g, ' ')
    .replace(/\d+\s*(?:g|克)/gi, ' ')
    .replace(/\s+/g, '')
    .trim();
}

function scoreNameMatch(productName: string, catalogTitle: string) {
  const a = normalizeFurmosaProductName(productName);
  const b = normalizeFurmosaProductName(catalogTitle);
  if (!a || !b) return 0;
  if (a === b) return a.length + 20;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) + 8;
  return 0;
}

export function matchFurmosaComImage(productName: string): string | null {
  const query = ALIASES[productName.trim()] ?? productName;
  let best: { score: number; imageUrl: string } | null = null;
  for (const item of PRODUCTS) {
    const score = scoreNameMatch(query, item.title);
    if (score < 2) continue;
    if (!best || score > best.score) {
      best = { score, imageUrl: item.imageUrl };
    }
  }
  return best?.imageUrl ?? null;
}

/** 收銀畫面優先用官網產品圖；對不到再退回資料庫既有網址。 */
export function resolveFurmosaProductImage(
  productName: string,
  storedUrl?: string | null,
) {
  return matchFurmosaComImage(productName) ?? storedUrl ?? null;
}
