import catalog from '@/lib/pos/data/furmosa-com-products.json';

export type FurmosaComProductImage = {
  title: string;
  handle: string;
  imageUrl: string;
};

const PRODUCTS = catalog as FurmosaComProductImage[];

/** 店裡／總部品名 → 官網標題裡比較好對的關鍵字 */
const ALIASES: Record<string, string> = {
  雞霸: '壕大大雞霸',
  原味雞霸: '壕大大雞霸',
  胡蘿蔔雞霸: '壕大大雞霸',
  壕大大雞霸原味: '壕大大雞霸',
  混合蔬果凍乾: '混蔬菜凍乾',
  蔬果凍乾: '混蔬菜凍乾',
  混合蔬果: '混蔬菜',
  牛肉地瓜乾: '牛肉地瓜',
  雞肉南瓜乾: '雞肉南瓜',
  鴨肉蘋果乾: '鴨肉蘋果',
  鴨喉嚨: '鴨喉',
  鴨脖喉: '鴨喉',
  鴨脖子: '鴨脖凍乾',
  豬耳片: '豬耳朵片',
  豬耳條: '豬耳朵條',
  豬蛋蛋: '豬蛋蛋肉乾',
  貓草雞肉薄片: '貓草雞肉乾薄片',
  貓草雞肉乾: '貓草雞肉乾薄片',
  雞丁凍乾: '雞肉丁凍乾',
  牠的月餅: '地瓜山藥雞肉月餅',
  月餅: '地瓜山藥雞肉月餅',
};

export function normalizeFurmosaProductName(name: string) {
  return name
    .replace(/[◈]/g, ' ')
    .replace(/[｜|·・,，.\-—_/*＋+]/g, ' ')
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

function queryVariants(productName: string): string[] {
  const trimmed = productName.trim();
  const normalized = normalizeFurmosaProductName(trimmed);
  const aliased = ALIASES[trimmed] ?? ALIASES[normalized];
  const queries = [trimmed, normalized];
  if (aliased) {
    queries.push(aliased, normalizeFurmosaProductName(aliased));
  }
  if (normalized.endsWith('乾') && normalized.length > 2) {
    queries.push(normalized.slice(0, -1));
  }
  return [...new Set(queries.filter(Boolean))];
}

export function matchFurmosaComImage(productName: string): string | null {
  let best: { score: number; imageUrl: string } | null = null;
  for (const query of queryVariants(productName)) {
    for (const item of PRODUCTS) {
      const score = scoreNameMatch(query, item.title);
      if (score < 2) continue;
      if (!best || score > best.score) {
        best = { score, imageUrl: item.imageUrl };
      }
    }
  }
  return best?.imageUrl ?? null;
}

/** 收銀畫面優先用官網產品 Cover；對不到再退回資料庫既有網址。 */
export function resolveFurmosaProductImage(
  productName: string,
  storedUrl?: string | null,
) {
  return matchFurmosaComImage(productName) ?? storedUrl ?? null;
}
