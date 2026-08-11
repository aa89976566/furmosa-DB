/**
 * 4B-D before/after capability inventory
 * 任何未盤點可寫操作禁止刪除／降級；contract test 對照此清單。
 */

export type MorningHqCapability = {
  id: string;
  label: string;
  /** 可寫 server action export 名稱；唯讀為 null */
  actionExport: string | null;
  /** presentation 錨點 data-capability */
  anchor: string;
  writable: boolean;
};

/** BEFORE（#101）盤點 — AFTER 必須全部可達 */
export const MORNING_HQ_CAPABILITIES: readonly MorningHqCapability[] = [
  {
    id: 'C-PLAN',
    label: '產生今日 plan preview（結構零發送）',
    actionExport: 'generateMorningPlanPreviewAction',
    anchor: 'capability-plan-preview',
    writable: true,
  },
  {
    id: 'C-PLAN-UX',
    label: 'Plan preview UX wrapper（同業務、回傳摘要）',
    actionExport: 'generateMorningPlanPreviewUxAction',
    anchor: 'capability-plan-preview',
    writable: true,
  },
  {
    id: 'C-MASTER',
    label: '總開關 on/off',
    actionExport: 'setMorningMasterEnabledAction',
    anchor: 'capability-master-switch',
    writable: true,
  },
  {
    id: 'C-QUOTA',
    label: '更新每日配額',
    actionExport: 'setMorningDailyQuotaAction',
    anchor: 'capability-daily-quota',
    writable: true,
  },
  {
    id: 'C-FIX-LOAD',
    label: '載入草稿範例',
    actionExport: 'ensureMorningFixturesAction',
    anchor: 'capability-fixture-load',
    writable: true,
  },
  {
    id: 'C-FIX-REFRESH',
    label: 'Preview 刷新新聞閘門',
    actionExport: 'refreshMorningNewsPreviewAction',
    anchor: 'capability-fixture-refresh',
    writable: true,
  },
  {
    id: 'C-CONTENT',
    label: '內容核准／回草稿／封存',
    actionExport: 'updateMorningContentStatusAction',
    anchor: 'capability-content-actions',
    writable: true,
  },
  {
    id: 'C-OPTIN-RO',
    label: '共用 Opt-in Preview（唯讀、不寫 preference）',
    actionExport: null,
    anchor: 'capability-optin-preview',
    writable: false,
  },
  {
    id: 'C-SOURCE',
    label: '來源健康／授權登錄',
    actionExport: null,
    anchor: 'capability-source-health',
    writable: false,
  },
  {
    id: 'C-TX',
    label: '交易通知覆蓋說明',
    actionExport: null,
    anchor: 'capability-transactional-notes',
    writable: false,
  },
  {
    id: 'C-NEWS',
    label: '已寫入新聞列',
    actionExport: null,
    anchor: 'capability-news-items',
    writable: false,
  },
  {
    id: 'C-GATE',
    label: 'Fixture 閘門即時預覽',
    actionExport: null,
    anchor: 'capability-fixture-gate',
    writable: false,
  },
  {
    id: 'C-LOGS',
    label: 'delivery／plan logs',
    actionExport: null,
    anchor: 'capability-delivery-logs',
    writable: false,
  },
] as const;

export const MORNING_HQ_WRITABLE_ACTION_EXPORTS = MORNING_HQ_CAPABILITIES.filter(
  (c) => c.actionExport,
).map((c) => c.actionExport as string);
