/** 從候選店家中挑「妞妞」驗收主店（不造假資料）。 */
export function pickNiuniuMerchant<T extends { name: string }>(
  candidates: T[],
): T | null {
  if (candidates.length === 0) return null;
  return (
    candidates.find((m) => m.name === '淡水妞妞') ??
    candidates.find((m) => m.name.includes('淡水妞妞')) ??
    candidates.find((m) => m.name.includes('妞妞寵物美容')) ??
    candidates.find((m) => m.name.includes('妞妞')) ??
    candidates[0] ??
    null
  );
}
