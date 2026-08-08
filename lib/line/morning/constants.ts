/** 壽司匠早安 MVP 常數（與飼料 Subscription／UGC Campaign 無關） */

export const MORNING_CAMPAIGN_KEY = 'morning';

export const MORNING_CONTENT_MODES = [
  'jokes',
  'news',
  'alternate',
  'off',
  'unset',
] as const;
export type MorningContentMode = (typeof MORNING_CONTENT_MODES)[number];

export const MORNING_FREQUENCIES = [
  'daily',
  'weekday',
  'weekly',
  'off',
  'unset',
] as const;
export type MorningFrequency = (typeof MORNING_FREQUENCIES)[number];

export const MORNING_CONTENT_STATUSES = ['DRAFT', 'APPROVED', 'ARCHIVED'] as const;
export type MorningContentStatus = (typeof MORNING_CONTENT_STATUSES)[number];

export const MORNING_NEWS_STATUSES = [
  'AUTO_APPROVED',
  'BLOCKED',
  'REVIEW_REQUIRED',
  'ARCHIVED',
] as const;
export type MorningNewsStatus = (typeof MORNING_NEWS_STATUSES)[number];

export const MORNING_DELIVERY_STATUSES = [
  'SENT',
  'SKIPPED',
  'FAILED',
  'DRY_RUN',
] as const;
export type MorningDeliveryStatus = (typeof MORNING_DELIVERY_STATUSES)[number];

export const MORNING_SKIP_REASONS = {
  KILL_SWITCH: 'kill_switch',
  QUOTA: 'quota',
  NOT_OPTED_IN: 'not_opted_in',
  PAUSED: 'paused',
  FREQUENCY_MISMATCH: 'frequency_mismatch',
  SLOT_NOT_YET: 'slot_not_yet',
  TRANSACTIONAL_PRIORITY: 'transactional_priority',
  NO_CONTENT: 'no_content',
  NO_SAFE_NEWS: 'no_safe_news',
  ALREADY_DELIVERED: 'already_delivered',
  OUTSIDE_WINDOW: 'outside_window',
  MASTER_OFF: 'master_off',
} as const;

/** 新聞時效窗（小時）；缺日期／未來／過期一律 fail-closed */
export const MORNING_NEWS_MAX_AGE_HOURS = 72;

export type MorningSkipReason =
  (typeof MORNING_SKIP_REASONS)[keyof typeof MORNING_SKIP_REASONS];

/** Asia/Taipei 發送窗：08:00–08:29 */
export const MORNING_WINDOW_START_MINUTE = 8 * 60;
export const MORNING_WINDOW_END_MINUTE = 8 * 60 + 29;
export const MORNING_SLOT_SPAN = 30;

/** 每週固定週五（0=週日 … 5=週五） */
export const MORNING_WEEKLY_WEEKDAY = 5;

export const MORNING_PET_TAGS = [
  'dog',
  'cat',
  'rabbit',
  'bird',
  'rodent',
  'general',
] as const;
export type MorningPetTag = (typeof MORNING_PET_TAGS)[number];

export const MORNING_SETTINGS_ID = 'default';

/** 環境變數：master kill switch（未設則看 DB；DB 預設 false） */
export const ENV_MORNING_MASTER_ENABLED = 'LINE_MORNING_MASTER_ENABLED';

/** Preview MVP：永遠不真送；僅 dry-run */
export const MORNING_PREVIEW_DRY_RUN_ONLY = true;
