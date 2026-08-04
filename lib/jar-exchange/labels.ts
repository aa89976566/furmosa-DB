export const customerServiceTypeLabel: Record<string, string> = {
  personal: '個人',
  subscription: '訂閱',
  jar_exchange: '換罐',
};

export const customerServiceStatusLabel: Record<string, string> = {
  active: '進行中',
  paused: '暫停',
  closed: '已結束',
};

export const jarCodeStatusLabel: Record<string, string> = {
  unused: '未使用',
  issued: '持有中',
  returned: '已回收',
  used: '已返航',
  expired: '已過期',
};

export const ledgerSourceLabel: Record<string, string> = {
  jar_code_redeem: '序號返航',
  manual_adjustment: '人工調整',
  reward_redemption: '獎勵兌換',
  grooming_coupon_redemption: '美容折價券兌換',
  campaign_bonus: '活動贈點',
  refill_completed: '換罐交付完成',
};

export const rewardActiveLabel: Record<string, string> = {
  active: '啟用',
  inactive: '停用',
};
