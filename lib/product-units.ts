/** 商品主檔計價單位 */
export const PRODUCT_UNIT_OPTIONS = [
  '克',
  'g',
  '包',
  '片',
  '顆',
  '支',
  '一支',
  '條',
  '隻',
  '罐',
  '盒',
  '袋',
  '組',
  '次',
  '件',
  '次',
] as const;

/** 寄賣進貨／銷售／訂單品項單位 */
export const ORDER_LINE_UNIT_OPTIONS = [
  '包',
  '片',
  '顆',
  '支',
  '一支',
  '條',
  '隻',
  '罐',
  '盒',
  '袋',
  '組',
  '次',
  '件',
  '次',
] as const;

/** 規格（按單位計價）常用單位 */
export const TIER_UNIT_PRESETS = ['次', '條', '隻', '片', '顆', '支', '一支', '包', '袋', '盒', '罐', '件'] as const;

/** 規格按單位：包裝數量快捷 */
export const TIER_UNIT_QTY_PRESETS = [1, 5, 10] as const;

export type ProductUnit = (typeof PRODUCT_UNIT_OPTIONS)[number];

/** A weighted retail tier counts packages; weight remains in weightGrams. */
export function packagedOrderUnit(unit: string | null | undefined, weightGrams?: number | null): string | null {
  const value = unit?.trim() || null;
  return weightGrams != null && weightGrams > 0 && /^(g|克|公克)$/i.test(value ?? '') ? '包' : value;
}
