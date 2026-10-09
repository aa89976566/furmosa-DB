import { formatTaipeiDateTime, taipeiLastNDaysRange } from '@/lib/taipei-date';

/** 序號返航與換罐交付完成。兩者都寫進點數帳本，不使用會員累積次數。 */
export const JAR_WEEK_ACTIVITY_SOURCE_TYPES = ['jar_code_redeem', 'refill_completed'] as const;

export const JAR_WEEK_ACTIVITY_DAYS = 7;
export const JAR_WEEK_ACTIVITY_PREVIEW_LIMIT = 8;

export type JarWeekActivitySourceType = (typeof JAR_WEEK_ACTIVITY_SOURCE_TYPES)[number];

export type JarWeekActivityEntry = {
  id: string;
  createdAt: Date;
  customerId: string;
  memberName: string;
  pointsChange: number;
  sourceType: string;
  storeName: string | null;
};

export type JarWeekActivityRow = {
  id: string;
  timeLabel: string;
  memberName: string;
  memberHref: string | null;
  storeName: string | null;
  pointsChange: number;
  exchangeCount: 1;
};

export type JarWeekActivityView = {
  rangeLabel: string;
  totalExchanges: number;
  participantCount: number;
  rows: JarWeekActivityRow[];
};

export function isJarWeekActivitySource(sourceType: string): sourceType is JarWeekActivitySourceType {
  return (JAR_WEEK_ACTIVITY_SOURCE_TYPES as readonly string[]).includes(sourceType);
}

/**
 * 合作店只取這筆交易自己的店家。
 * 序號返航看回收店，沒有再看發放店；換罐完成看訂單店。
 * 不使用會員開戶店或累積次數。
 */
export function jarActivityStoreName(input: {
  sourceType: string;
  returnedMerchantName?: string | null;
  issuedMerchantName?: string | null;
  refillMerchantName?: string | null;
}): string | null {
  const picked =
    input.sourceType === 'refill_completed'
      ? input.refillMerchantName
      : input.sourceType === 'jar_code_redeem'
        ? input.returnedMerchantName?.trim() || input.issuedMerchantName
        : null;
  const name = picked?.trim();
  return name ? name : null;
}

export function presentJarWeekActivity(
  entries: JarWeekActivityEntry[],
  reference = new Date(),
): JarWeekActivityView {
  const range = taipeiLastNDaysRange(JAR_WEEK_ACTIVITY_DAYS, reference);
  const inWindow = entries.filter(
    (entry) =>
      isJarWeekActivitySource(entry.sourceType) &&
      entry.createdAt >= range.start &&
      entry.createdAt <= range.end,
  );
  const sorted = [...inWindow].sort((a, b) => {
    const byTime = b.createdAt.getTime() - a.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  });
  const participants = new Set(sorted.map((entry) => entry.customerId));

  return {
    rangeLabel: `${range.startKey.replaceAll('-', '/')}–${range.endKey.replaceAll('-', '/')}`,
    totalExchanges: sorted.length,
    participantCount: participants.size,
    rows: sorted.slice(0, JAR_WEEK_ACTIVITY_PREVIEW_LIMIT).map((entry) => ({
      id: entry.id,
      timeLabel: formatTaipeiDateTime(entry.createdAt),
      memberName: entry.memberName.trim() || '未命名會員',
      memberHref: entry.customerId ? `/customers/${entry.customerId}` : null,
      storeName: entry.storeName,
      pointsChange: entry.pointsChange,
      exchangeCount: 1,
    })),
  };
}
