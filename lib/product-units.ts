/** 商品主檔計價單位 */
export const PRODUCT_UNIT_OPTIONS = [
  '克',
  'g',
  '包',
  '片',
  '支',
  '一支',
  '隻',
  '罐',
  '盒',
  '袋',
  '組',
  '件',
] as const;

/** 寄賣進貨／銷售／訂單品項單位 */
export const ORDER_LINE_UNIT_OPTIONS = [
  '包',
  '片',
  '支',
  '一支',
  '隻',
  '罐',
  '盒',
  '袋',
  '組',
  '件',
] as const;

/** 規格（按單位計價）常用單位 */
export const TIER_UNIT_PRESETS = ['隻', '片', '支', '一支', '包', '袋', '盒', '罐'] as const;

export type ProductUnit = (typeof PRODUCT_UNIT_OPTIONS)[number];
