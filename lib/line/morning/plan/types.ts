/** Phase 4B-C plan ledger／runner typed contracts */

export const MORNING_PLAN_STATUSES = ['PLANNED', 'SKIPPED'] as const;
export type MorningPlanStatus = (typeof MORNING_PLAN_STATUSES)[number];

/** typed decision reasons（plan ledger／Preview 共用） */
export const MORNING_PLAN_REASONS = {
  PLANNED: 'planned',
  NOT_OPTED_IN: 'not_opted_in',
  NOT_CONFIRMED: 'not_confirmed',
  OPTED_OUT: 'opted_out',
  FREQUENCY_MISMATCH: 'frequency_mismatch',
  TRANSACTIONAL_PRIORITY: 'transactional_priority',
  NO_SAFE_NEWS: 'no_safe_news',
  NO_CONTENT: 'no_content',
  ALREADY_PLANNED: 'already_planned',
  BAD_PREFERENCE: 'bad_preference',
} as const;

export type MorningPlanReason =
  (typeof MORNING_PLAN_REASONS)[keyof typeof MORNING_PLAN_REASONS];

export type MorningPlanLedgerRow = {
  id: string;
  lineUserId: string;
  runDate: string;
  contentId: string | null;
  contentType: string | null;
  decisionReason: string;
  planStatus: MorningPlanStatus;
  createdAt: Date;
};
