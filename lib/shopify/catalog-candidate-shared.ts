export const CANDIDATE_BLOCK_REASONS = [
  '停售',
  '測試商品',
  '贈品或組合內容',
  '不由 HQ 履約',
  '其他',
] as const;

export type CandidateBlockReason = (typeof CANDIDATE_BLOCK_REASONS)[number];
