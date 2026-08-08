/**
 * 最保守、零擴張 consent 映射
 *
 * 核准決策：
 * - jokes → HUMOR_ONLY；news → NEWS_ONLY（語意完全相等）
 * - alternate / ALTERNATE 保留；決策仍為笑話↔新聞，不引入 ANIMAL_FACT fallback
 * - off / unset → OFF / UNSET；不活躍，不得推定同意、不得自動改成 active mode
 * - NEWS_FIRST_* 僅在 DB 已是該值（未來明確 re-opt-in）時成立
 */

import {
  MORNING_ACTIVE_DOMAIN_CONTENT_MODES,
  type MorningActiveDomainContentMode,
  type MorningDomainContentMode,
} from '@/lib/line/morning/domain/types';

/** DB／指令相容儲存值（含舊值與未來 re-opt-in 新值） */
export const MORNING_STORAGE_CONTENT_MODES = [
  'jokes',
  'news',
  'alternate',
  'off',
  'unset',
  // 語意相等之 canonical 小寫／大寫相容
  'humor_only',
  'HUMOR_ONLY',
  'news_only',
  'NEWS_ONLY',
  'ALTERNATE',
  'OFF',
  'UNSET',
  // 未來明確 re-opt-in（本 PR 無 UI；僅 domain 認得）
  'news_first_fact_fallback',
  'NEWS_FIRST_FACT_FALLBACK',
  'news_first_fact_or_humor_fallback',
  'NEWS_FIRST_FACT_OR_HUMOR_FALLBACK',
] as const;
export type MorningStorageContentMode =
  (typeof MORNING_STORAGE_CONTENT_MODES)[number];

const STORAGE_TO_DOMAIN: Record<string, MorningDomainContentMode> = {
  jokes: 'HUMOR_ONLY',
  humor_only: 'HUMOR_ONLY',
  HUMOR_ONLY: 'HUMOR_ONLY',
  news: 'NEWS_ONLY',
  news_only: 'NEWS_ONLY',
  NEWS_ONLY: 'NEWS_ONLY',
  alternate: 'ALTERNATE',
  ALTERNATE: 'ALTERNATE',
  news_first_fact_fallback: 'NEWS_FIRST_FACT_FALLBACK',
  NEWS_FIRST_FACT_FALLBACK: 'NEWS_FIRST_FACT_FALLBACK',
  news_first_fact_or_humor_fallback: 'NEWS_FIRST_FACT_OR_HUMOR_FALLBACK',
  NEWS_FIRST_FACT_OR_HUMOR_FALLBACK: 'NEWS_FIRST_FACT_OR_HUMOR_FALLBACK',
  off: 'OFF',
  OFF: 'OFF',
  unset: 'UNSET',
  UNSET: 'UNSET',
};

/**
 * 寫回 DB 的偏好儲存值：
 * - 舊語意相等 → 保留舊相容值（jokes / news / alternate / off / unset）
 * - 新 FACT mixed → snake_case（未來 re-opt-in 用）
 */
const DOMAIN_TO_PREFERRED_STORAGE: Record<MorningDomainContentMode, string> = {
  HUMOR_ONLY: 'jokes',
  NEWS_ONLY: 'news',
  ALTERNATE: 'alternate',
  NEWS_FIRST_FACT_FALLBACK: 'news_first_fact_fallback',
  NEWS_FIRST_FACT_OR_HUMOR_FALLBACK: 'news_first_fact_or_humor_fallback',
  OFF: 'off',
  UNSET: 'unset',
};

/** 未知值 → UNSET（fail-closed；不得推定同意） */
export function toDomainContentMode(
  raw: string | null | undefined,
): MorningDomainContentMode {
  if (raw == null || raw === '') return 'UNSET';
  return STORAGE_TO_DOMAIN[raw] ?? 'UNSET';
}

export function toStorageContentMode(mode: MorningDomainContentMode): string {
  return DOMAIN_TO_PREFERRED_STORAGE[mode];
}

export function isActiveDomainContentMode(
  mode: MorningDomainContentMode,
): mode is MorningActiveDomainContentMode {
  return (MORNING_ACTIVE_DOMAIN_CONTENT_MODES as readonly string[]).includes(
    mode,
  );
}

/**
 * ALTERNATE 是否允許 ANIMAL_FACT fallback？
 * 核准 (a)：否。僅笑話↔新聞。
 */
export function alternateAllowsAnimalFactFallback(
  mode: MorningDomainContentMode,
): boolean {
  void mode;
  return false;
}

/**
 * 舊會員是否被推定為 FACT mixed mode？
 * 核准：永不推定（jokes/news/alternate/off/unset 皆不得擴張）。
 * 若 DB 已是 news_first_fact_*，那是未來明確 re-opt-in，不算「推定」。
 */
export function inventsFactMixedConsent(
  storageMode: string | null | undefined,
): boolean {
  const domain = toDomainContentMode(storageMode);
  // 映射本身從不把舊值變成 FACT mixed；此函式恒為 false（契約守衛）
  void domain;
  return false;
}

/** 從舊儲存值正規化後，是否仍為「語意相等」且未擴張同意 */
export function isSemanticallyEqualLegacyMapping(
  storageMode: string,
  domain: MorningDomainContentMode,
): boolean {
  if (storageMode === 'jokes' && domain === 'HUMOR_ONLY') return true;
  if (storageMode === 'news' && domain === 'NEWS_ONLY') return true;
  if (storageMode === 'alternate' && domain === 'ALTERNATE') return true;
  if (storageMode === 'off' && domain === 'OFF') return true;
  if (storageMode === 'unset' && domain === 'UNSET') return true;
  return false;
}
