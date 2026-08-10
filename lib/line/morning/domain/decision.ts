/**
 * Phase 4B-A decision engine（4B-C CONSENSUS 演進 ALTERNATE）
 * contentMode × availability → 選內容或 skip
 *
 * 規則摘要：
 * - HUMOR_ONLY：只走 HUMOR；無內容 → SKIPPED_NO_CONTENT
 * - NEWS_ONLY：只走 NEWS；無安全新聞 → SKIPPED_NO_SAFE_NEWS（不得改 HUMOR／FACT）
 * - ALTERNATE（4B-C）：下一類＝上一筆 SENT SUCCESS contentType；無歷史→HUMOR；
 *   輪到 NEWS 但無合格來源 → SKIP（不暗換笑話）；不推進（由 runner／delivery SENT 推進）
 * - NEWS_FIRST_FACT_FALLBACK：NEWS → FACT；皆無 → SKIPPED_NO_CONTENT（不退 HUMOR）
 * - NEWS_FIRST_FACT_OR_HUMOR_FALLBACK：NEWS → FACT → HUMOR；皆無 → SKIPPED_NO_CONTENT
 * - OFF／UNSET：不活躍 → NOT_OPTED_IN
 */

import {
  alternateAllowsAnimalFactFallback,
  toDomainContentMode,
} from '@/lib/line/morning/domain/consent';
import {
  MORNING_DOMAIN_SKIP,
  type MorningContentType,
  type MorningDomainContentMode,
} from '@/lib/line/morning/domain/types';

export type MorningAvailability = {
  hasSafeNews: boolean;
  hasAnimalFact: boolean;
  hasHumor: boolean;
};

export type MorningDecision =
  | {
      outcome: 'DELIVER';
      contentType: MorningContentType;
      /** alternate 當天主選（供觀測） */
      primaryIntent?: MorningContentType;
      usedFallback?: boolean;
    }
  | {
      outcome: 'SKIP';
      reason:
        | typeof MORNING_DOMAIN_SKIP.SKIPPED_NO_SAFE_NEWS
        | typeof MORNING_DOMAIN_SKIP.SKIPPED_NO_CONTENT
        | typeof MORNING_DOMAIN_SKIP.NOT_OPTED_IN;
      attempted?: MorningContentType;
    };

/**
 * @deprecated 4B-C 禁止以日期奇偶推進 alternate；保留函式僅供舊測試對照，
 * plan runner 不得呼叫。請用 resolveAlternatePrimaryIntent。
 */
export function alternatePrimaryIntent(
  taipeiDate: string,
): 'HUMOR' | 'NEWS' {
  const dayNum = Number(String(taipeiDate).replace(/-/g, ''));
  if (!Number.isFinite(dayNum)) return 'HUMOR';
  return dayNum % 2 === 0 ? 'HUMOR' : 'NEWS';
}

/**
 * 4B-C CONSENSUS：alternate 下一類型
 * - 無歷史 SUCCESS → 第一類 HUMOR
 * - 上一筆 HUMOR SUCCESS → 下次 NEWS
 * - 上一筆 NEWS SUCCESS → 下次 HUMOR
 * - PLANNED／SKIPPED／dry-run 不應傳入（不算歷史）
 */
export function resolveAlternatePrimaryIntent(input: {
  lastSuccessContentType?: MorningContentType | null;
}): 'HUMOR' | 'NEWS' {
  const last = input.lastSuccessContentType;
  if (last === 'HUMOR') return 'NEWS';
  if (last === 'NEWS') return 'HUMOR';
  return 'HUMOR';
}

function deliver(
  contentType: MorningContentType,
  opts?: { primaryIntent?: MorningContentType; usedFallback?: boolean },
): MorningDecision {
  return {
    outcome: 'DELIVER',
    contentType,
    primaryIntent: opts?.primaryIntent,
    usedFallback: opts?.usedFallback,
  };
}

function skipNoContent(attempted?: MorningContentType): MorningDecision {
  return {
    outcome: 'SKIP',
    reason: MORNING_DOMAIN_SKIP.SKIPPED_NO_CONTENT,
    attempted,
  };
}

function skipNoSafeNews(): MorningDecision {
  return {
    outcome: 'SKIP',
    reason: MORNING_DOMAIN_SKIP.SKIPPED_NO_SAFE_NEWS,
    attempted: 'NEWS',
  };
}

export function decideMorningContent(input: {
  contentMode: string | MorningDomainContentMode;
  availability: MorningAvailability;
  /** Asia/Taipei YYYY-MM-DD（非 alternate 推進依據；保留相容） */
  taipeiDate: string;
  /**
   * 4B-C：上一筆實際 SENT morning delivery 的 contentType。
   * alternate 專用；dry-run／SKIP／PLANNED 不得當作歷史。
   */
  lastSuccessContentType?: MorningContentType | null;
  /** 可選：呼叫端已算好的 alternate 主選（測試／顯式覆寫） */
  alternatePrimaryIntent?: 'HUMOR' | 'NEWS';
}): MorningDecision {
  const mode = toDomainContentMode(String(input.contentMode));
  const { availability } = input;

  if (mode === 'OFF' || mode === 'UNSET') {
    return { outcome: 'SKIP', reason: MORNING_DOMAIN_SKIP.NOT_OPTED_IN };
  }

  if (mode === 'HUMOR_ONLY') {
    if (availability.hasHumor) return deliver('HUMOR');
    return skipNoContent('HUMOR');
  }

  if (mode === 'NEWS_ONLY') {
    if (availability.hasSafeNews) return deliver('NEWS');
    return skipNoSafeNews();
  }

  if (mode === 'ALTERNATE') {
    void alternateAllowsAnimalFactFallback(mode);
    const primary =
      input.alternatePrimaryIntent ??
      resolveAlternatePrimaryIntent({
        lastSuccessContentType: input.lastSuccessContentType ?? null,
      });
    if (primary === 'HUMOR') {
      if (availability.hasHumor) {
        return deliver('HUMOR', { primaryIntent: 'HUMOR' });
      }
      return skipNoContent('HUMOR');
    }
    // NEWS：無合格來源 → SKIP，絕不暗換笑話（4B-C）
    if (availability.hasSafeNews) {
      return deliver('NEWS', { primaryIntent: 'NEWS' });
    }
    return skipNoSafeNews();
  }

  if (mode === 'NEWS_FIRST_FACT_FALLBACK') {
    if (availability.hasSafeNews) return deliver('NEWS');
    if (availability.hasAnimalFact) {
      return deliver('ANIMAL_FACT', { primaryIntent: 'NEWS', usedFallback: true });
    }
    return skipNoContent('NEWS');
  }

  if (mode === 'NEWS_FIRST_FACT_OR_HUMOR_FALLBACK') {
    if (availability.hasSafeNews) return deliver('NEWS');
    if (availability.hasAnimalFact) {
      return deliver('ANIMAL_FACT', { primaryIntent: 'NEWS', usedFallback: true });
    }
    if (availability.hasHumor) {
      return deliver('HUMOR', { primaryIntent: 'NEWS', usedFallback: true });
    }
    return skipNoContent('NEWS');
  }

  return { outcome: 'SKIP', reason: MORNING_DOMAIN_SKIP.NOT_OPTED_IN };
}

/** Delivery／runner 用的 contentKind 字串（相容既有 joke|news） */
export function contentTypeToDeliveryKind(
  contentType: MorningContentType,
): 'joke' | 'news' | 'animal_fact' {
  if (contentType === 'HUMOR') return 'joke';
  if (contentType === 'NEWS') return 'news';
  return 'animal_fact';
}

/** delivery contentKind → domain contentType */
export function deliveryKindToContentType(
  kind: string | null | undefined,
): MorningContentType | null {
  if (kind === 'joke' || kind === 'HUMOR') return 'HUMOR';
  if (kind === 'news' || kind === 'NEWS') return 'NEWS';
  if (kind === 'animal_fact' || kind === 'ANIMAL_FACT') return 'ANIMAL_FACT';
  return null;
}
