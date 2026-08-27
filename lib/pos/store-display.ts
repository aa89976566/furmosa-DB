export type StoreHeading = {
  brandLine: string;
  branchLine: string | null;
  combined: string;
};

/**
 * 店名兩行：品牌 + 分店。不寫死「中和店」。
 * 例：name=泡泡堂中和店, city=中和 → 泡泡堂 / 中和店
 */
export function storeHeading(input: {
  name: string;
  city?: string | null;
}): StoreHeading {
  const name = input.name.trim() || '店家';
  const city = (input.city ?? '').trim();
  if (!city) {
    return { brandLine: name, branchLine: null, combined: name };
  }

  const cityCore = city
    .replace(/店$/u, '')
    .replace(/(區|市|鎮|鄉)$/u, '')
    .trim();
  const branchLine = cityCore ? `${cityCore}店` : `${city}店`;

  let brandLine = name;
  for (const token of [branchLine, `${cityCore}店`, city, cityCore]) {
    if (!token) continue;
    brandLine = brandLine.split(token).join(' ').replace(/\s+/g, ' ').trim();
  }
  if (!brandLine) brandLine = name;

  return {
    brandLine,
    branchLine,
    combined: `${brandLine} ${branchLine}`.trim(),
  };
}
