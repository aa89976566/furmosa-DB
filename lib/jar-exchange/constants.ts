export const CUSTOMER_SERVICE_TYPES = ['personal', 'subscription', 'jar_exchange'] as const;
export type CustomerServiceType = (typeof CUSTOMER_SERVICE_TYPES)[number];

export const LEDGER_SOURCE_TYPES = [
  'jar_code_redeem',
  'manual_adjustment',
  'reward_redemption',
  'grooming_coupon_redemption',
  'campaign_bonus',
] as const;
export type LedgerSourceType = (typeof LEDGER_SOURCE_TYPES)[number];

export const JAR_CODE_STATUSES = ['unused', 'used', 'expired'] as const;
export const COST_CATEGORIES = ['jar_return_program', 'member_loyalty', 'marketing'] as const;
