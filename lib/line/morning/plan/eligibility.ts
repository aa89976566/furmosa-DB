/**
 * Phase 4B-C eligibility（單一 eligible boolean／typed SKIP）
 * - 不預設 DAILY、不推定同意
 * - NULL/UNSET/缺 frequency/未確認/OPTED_OUT → typed skip
 */

import {
  isActivelySubscribed,
  isPreferenceComplete,
  type MorningPreferenceRow,
} from '@/lib/line/morning/preferences';
import { frequencyMatchesDay } from '@/lib/line/morning/schedule';
import {
  MORNING_PLAN_REASONS,
  type MorningPlanReason,
} from '@/lib/line/morning/plan/types';
import { toDomainContentMode } from '@/lib/line/morning/domain/consent';
import { toDomainFrequency } from '@/lib/line/morning/domain/frequency';

export type EligibilityInput = {
  preference: MorningPreferenceRow | null | undefined;
  /** 是否有 ConfirmLedger SUCCESS（或 legacy 已完整設定視為已確認） */
  hasConfirmSuccess: boolean;
  /** Asia/Taipei 當日對應的 Date（用於 frequency 星期判斷） */
  runInstant: Date;
};

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: MorningPlanReason };

/**
 * legacy：preference 完整（content+frequency 皆非 unset）且非 off → 視為已確認
 * （舊流程寫入完成者；新流程以 ConfirmLedger 為準）
 */
export function isLegacyConfirmedPreference(
  pref: MorningPreferenceRow | null | undefined,
): boolean {
  if (!pref) return false;
  return isPreferenceComplete(pref);
}

export function evaluateMorningPlanEligibility(
  input: EligibilityInput,
): EligibilityResult {
  const pref = input.preference;
  if (!pref) {
    return { eligible: false, reason: MORNING_PLAN_REASONS.NOT_OPTED_IN };
  }

  try {
    const domainMode = toDomainContentMode(pref.contentMode);
    const domainFreq = toDomainFrequency(pref.frequency);

    if (domainMode === 'OFF' || domainFreq === 'OFF') {
      return { eligible: false, reason: MORNING_PLAN_REASONS.OPTED_OUT };
    }
    if (domainMode === 'UNSET' || domainFreq === 'UNSET') {
      return { eligible: false, reason: MORNING_PLAN_REASONS.NOT_CONFIRMED };
    }
    if (pref.pausedAt) {
      return { eligible: false, reason: MORNING_PLAN_REASONS.OPTED_OUT };
    }
    if (!input.hasConfirmSuccess && !isLegacyConfirmedPreference(pref)) {
      return { eligible: false, reason: MORNING_PLAN_REASONS.NOT_CONFIRMED };
    }
    if (!isActivelySubscribed(pref)) {
      return { eligible: false, reason: MORNING_PLAN_REASONS.NOT_OPTED_IN };
    }
    if (!frequencyMatchesDay(pref.frequency, input.runInstant)) {
      return { eligible: false, reason: MORNING_PLAN_REASONS.FREQUENCY_MISMATCH };
    }
    return { eligible: true };
  } catch {
    return { eligible: false, reason: MORNING_PLAN_REASONS.BAD_PREFERENCE };
  }
}
