/**
 * HQ /campaigns/line-morning tab contract（4B-D）
 * - 真 search param；非法／空／大小寫不符 → canonical today
 * - 不 throw、不空白頁
 */

export const MORNING_DASHBOARD_TABS = [
  'today',
  'content',
  'preferences',
  'system',
] as const;

export type MorningDashboardTab = (typeof MORNING_DASHBOARD_TABS)[number];

export const MORNING_DASHBOARD_TAB_LABELS: Record<MorningDashboardTab, string> = {
  today: '今日早安',
  content: '內容庫',
  preferences: '會員設定',
  system: '系統狀態',
};

export const MORNING_DASHBOARD_DEFAULT_TAB: MorningDashboardTab = 'today';

export function isMorningDashboardTab(value: string): value is MorningDashboardTab {
  return (MORNING_DASHBOARD_TABS as readonly string[]).includes(value);
}

/** 未知、重複、空字串、大小寫不符 → today */
export function parseMorningDashboardTab(
  raw: string | string[] | null | undefined,
): MorningDashboardTab {
  if (raw == null) return MORNING_DASHBOARD_DEFAULT_TAB;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== 'string') return MORNING_DASHBOARD_DEFAULT_TAB;
  const trimmed = first.trim();
  if (!trimmed) return MORNING_DASHBOARD_DEFAULT_TAB;
  if (isMorningDashboardTab(trimmed)) return trimmed;
  return MORNING_DASHBOARD_DEFAULT_TAB;
}

export function morningDashboardHref(tab: MorningDashboardTab): string {
  if (tab === MORNING_DASHBOARD_DEFAULT_TAB) {
    return '/campaigns/line-morning';
  }
  return `/campaigns/line-morning?tab=${tab}`;
}
