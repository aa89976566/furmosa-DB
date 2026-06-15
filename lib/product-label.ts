// 統一商品顯示：把 g 數 / 單位接到名字後面，避免重複顯示
//   productLabel('雞肉丁凍乾', 30)             → '雞肉丁凍乾 30g'
//   productLabel('雞肉丁凍乾30g', 30)          → '雞肉丁凍乾30g'  (名字已含 30g)
//   productLabel('胡蘿蔔雞霸', null)           → '胡蘿蔔雞霸'
//   productLabel('胡蘿蔔雞霸', 50, '片')        → '胡蘿蔔雞霸 50g（片）'
export function productLabel(
  name: string,
  weightGrams?: number | null,
  unit?: string | null,
): string {
  let out = name;
  if (weightGrams && weightGrams > 0) {
    const re = new RegExp(`\\b${weightGrams}\\s*g\\b`, 'i');
    if (!re.test(name)) out = `${out} ${weightGrams}g`;
  }
  if (unit && unit.trim() && unit !== '件') {
    out = `${out}（${unit}）`;
  }
  return out;
}

// 從現有商品名嘗試抓出 g 數，例如 '簡記牛肉地瓜50g' → 50, '雞肉丁凍乾' → null
export function parseWeightFromName(name: string): number | null {
  const m = name.match(/(\d+)\s*g\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type WeightTierLike = {
  weightGrams: number | null;
  unit: string;
  unitQty: number;
};

/** 盤點／庫存表：規格克數摘要（多規格以頓號連接） */
export function resolveProductWeightLabel(
  name: string,
  tiers: WeightTierLike[],
): string | null {
  if (tiers.length > 0) {
    const labels = [
      ...new Set(
        tiers
          .map((tier) => {
            if (tier.weightGrams && tier.weightGrams > 0) return `${tier.weightGrams}g`;
            return null;
          })
          .filter((label): label is string => Boolean(label)),
      ),
    ];
    if (labels.length > 0) return labels.join('、');
  }
  const fromName = parseWeightFromName(name);
  return fromName ? `${fromName}g` : null;
}
