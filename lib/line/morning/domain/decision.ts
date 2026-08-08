/**
 * Phase 4B-A decision engine
 * contentMode × availability → 選內容或 skip
 *
 * 規則摘要：
 * - HUMOR_ONLY：只走 HUMOR；無內容 → SKIPPED_NO_CONTENT
 * - NEWS_ONLY：只走 NEWS；無安全新聞 → SKIPPED_NO_SAFE_NEWS（不得改 HUMOR／FACT）
 * - ALTERNATE：笑話↔新聞交替；新聞日無安全新聞 → 可退 HUMOR；仍無 → SKIPPED_NO_CONTENT
 *   （核准：不引入 ANIMAL_FACT fallback）
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

/** ALTERNATE：用台北日 YYYY-MM-DD 奇偶決定主選（偶數 HUMOR、奇數 NEWS） */
export function alternatePrimaryIntent(
  taipeiDate: string,
): 'HUMOR' | 'NEWS' {
  const dayNum = Number(String(taipeiDate).replace(/-/g, ''));
  if (!Number.isFinite(dayNum)) return 'HUMOR';
  return dayNum % 2 === 0 ? 'HUMOR' : 'NEWS';
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
  /** Asia/Taipei YYYY-MM-DD；ALTERNATE 用 */
  taipeiDate: string;
}): MorningDecision {
  const mode = toDomainContentMode(String(input.contentMode));
  const { availability, taipeiDate } = input;

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
    // 契約守衛：核准 (a) — ALTERNATE 永不開 ANIMAL_FACT fallback
    void alternateAllowsAnimalFactFallback(mode);
    const primary = alternatePrimaryIntent(taipeiDate);
    if (primary === 'HUMOR') {
      if (availability.hasHumor) {
        return deliver('HUMOR', { primaryIntent: 'HUMOR' });
      }
      return skipNoContent('HUMOR');
    }
    // primary NEWS
    if (availability.hasSafeNews) {
      return deliver('NEWS', { primaryIntent: 'NEWS' });
    }
    if (availability.hasHumor) {
      return deliver('HUMOR', { primaryIntent: 'NEWS', usedFallback: true });
    }
    return skipNoContent('NEWS');
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

  // fail-closed
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
