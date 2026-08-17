/**
 * 開箱 UGC 入口 keyword matcher。
 * 只做正規化後的精確 phrase 比對，避免「合作」「試吃」「開箱」模糊 contains 誤觸其他活動。
 */

/** 正規化後可進入開箱邀請的明確 phrase（小寫、無空白／標點） */
export const JIBA_UNBOX_ENTRY_PHRASES = [
  '開箱',
  '開箱文',
  '開箱任務',
  'ugc',
  '試吃開箱',
  '開箱合作',
  '合作開箱',
  // 既有選單／別名：仍走開箱，不走青蛙專案
  '毛孩來開箱',
  '來開箱',
  '開箱研究',
] as const;

const ENTRY_SET = new Set(
  JIBA_UNBOX_ENTRY_PHRASES.map((phrase) => normalizeJibaUnboxKeyword(phrase)),
);

/**
 * 入口比對用正規化：去零寬、NFKC（全形→半形）、小寫、去掉空白與標點。
 * 不使用 contains，因此「查看合作店」「試吃看看」不會命中。
 */
export function normalizeJibaUnboxKeyword(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

export function isJibaUnboxEntryIntent(raw: string): boolean {
  if (!raw) return false;
  return ENTRY_SET.has(normalizeJibaUnboxKeyword(raw));
}
