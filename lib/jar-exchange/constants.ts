export const CUSTOMER_SERVICE_TYPES = ['personal', 'subscription', 'jar_exchange'] as const;
export type CustomerServiceType = (typeof CUSTOMER_SERVICE_TYPES)[number];

export const LEDGER_SOURCE_TYPES = [
  'jar_code_redeem',
  'manual_adjustment',
  'reward_redemption',
  'grooming_coupon_redemption',
  'campaign_bonus',
  'refill_completed',
] as const;
export type LedgerSourceType = (typeof LEDGER_SOURCE_TYPES)[number];

/** unused→used = LINE 兑碼；unused→issued→returned = 換罐生命週期 */
export const JAR_CODE_STATUSES = [
  'unused',
  'issued',
  'returned',
  'used',
  'expired',
] as const;
export const COST_CATEGORIES = ['jar_return_program', 'member_loyalty', 'marketing'] as const;
