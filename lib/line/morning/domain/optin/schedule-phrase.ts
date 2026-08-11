/**
 * 完成訊息用的自然 schedule phrase（避免「每個每天早上」語病）
 * 內部 key 仍為 daily|weekday|weekly；僅 presentation。
 */

import type { MorningFrequency } from '@/lib/line/morning/constants';

export type ActiveMorningFrequency = Extract<
  MorningFrequency,
  'daily' | 'weekday' | 'weekly'
>;

/** 短 mapping：每天早上／平日早上／每週五早上 */
export function frequencyMorningText(
  frequency: ActiveMorningFrequency | string,
): string {
  switch (frequency) {
    case 'daily':
      return '每天早上';
    case 'weekday':
      return '平日早上';
    case 'weekly':
      return '每週五早上';
    default:
      return '早上';
  }
}

/**
 * 完整開場句：之後每天早上…／之後每個平日早上…／之後每週五早上…
 */
export function renderScheduleLeadPhrase(
  frequency: ActiveMorningFrequency | string,
): string {
  switch (frequency) {
    case 'daily':
      return '之後每天早上';
    case 'weekday':
      return '之後每個平日早上';
    case 'weekly':
      return '之後每週五早上';
    default:
      return '之後早上';
  }
}
