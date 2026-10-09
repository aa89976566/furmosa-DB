const TAIPEI_TIME_ZONE = 'Asia/Taipei';

function taipeiDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function addTaipeiCalendarDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00+08:00`);
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  return taipeiDateKey(date);
}

export function jarWeekActivityRange(days: number, reference = new Date()) {
  const endKey = taipeiDateKey(reference);
  const startKey = addTaipeiCalendarDays(endKey, -(days - 1));
  return {
    startKey,
    endKey,
    start: new Date(`${startKey}T00:00:00+08:00`),
    end: new Date(`${endKey}T23:59:59.999+08:00`),
  };
}

function formatTaipeiDateTime(value: Date): string {
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: TAIPEI_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
  return `${taipeiDateKey(value).replaceAll('-', '/')} ${clock}`;
}

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
  const range = jarWeekActivityRange(JAR_WEEK_ACTIVITY_DAYS, reference);
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
