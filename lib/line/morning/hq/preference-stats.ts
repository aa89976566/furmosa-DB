/** HQ 會員設定統計（唯讀；不寫 preference） */

export type MorningPreferenceFrequencyStats = {
  daily: number;
  weekday: number;
  weekly: number;
  off: number;
  unset: number;
  other: number;
  total: number;
};

export function emptyPreferenceFrequencyStats(): MorningPreferenceFrequencyStats {
  return {
    daily: 0,
    weekday: 0,
    weekly: 0,
    off: 0,
    unset: 0,
    other: 0,
    total: 0,
  };
}

export function tallyPreferenceFrequencies(
  rows: Array<{ frequency: string }>,
): MorningPreferenceFrequencyStats {
  const stats = emptyPreferenceFrequencyStats();
  for (const row of rows) {
    stats.total += 1;
    switch (row.frequency) {
      case 'daily':
        stats.daily += 1;
        break;
      case 'weekday':
        stats.weekday += 1;
        break;
      case 'weekly':
        stats.weekly += 1;
        break;
      case 'off':
        stats.off += 1;
        break;
      case 'unset':
        stats.unset += 1;
        break;
      default:
        stats.other += 1;
        break;
    }
  }
  return stats;
}
