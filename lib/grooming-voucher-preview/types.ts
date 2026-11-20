/** UI-only preview types. Synthetic IDs only. No DB / API models. */

export const FIXTURE_KEYS = [
  'available_200',
  'available_250',
  'wrong_store',
  'expired',
  'already_redeemed',
  'offline',
] as const;

export type FixtureKey = (typeof FIXTURE_KEYS)[number];

export type VoucherLookupKind =
  | 'available'
  | 'wrong_store'
  | 'expired'
  | 'already_redeemed'
  | 'offline';

export type PosStep = 'home' | 'lookup' | 'review' | 'receipt';

export type PosBlockReason =
  | 'wrong_store'
  | 'expired'
  | 'already_redeemed'
  | 'offline'
  | 'amount_not_greater'
  | 'service_not_confirmed'
  | 'duplicate_submit'
  | 'invalid_amount'
  | 'code_required'
  | 'cancel_reason_required';

export type PreviewVoucher = {
  code: string;
  kind: VoucherLookupKind;
  faceValue: number;
  memberNicknameMasked: string;
  boundStoreId: string;
  boundStoreLabel: string;
  expiresOn: string;
  statusLabel: string;
};

export type PreviewReceipt = {
  reference: string;
  redeemedAtLabel: string;
  storeLabel: string;
  subsidyAmount: number;
  serviceTotal: number;
  faceValue: number;
};

export type PosSession = {
  fixtureKey: FixtureKey;
  step: PosStep;
  codeInput: string;
  lookedUp: boolean;
  serviceTotalInput: string;
  serviceConfirmed: boolean;
  submitting: boolean;
  redeemed: boolean;
  receipt: PreviewReceipt | null;
  cancelReason: string;
  cancelSubmitted: boolean;
  blockReason: PosBlockReason | null;
  liveMessage: string;
};

export type HqCancelTab = 'pending' | 'approved' | 'rejected';

export type HqCancelStatus = HqCancelTab;

export type HqTimelineEvent = {
  atLabel: string;
  title: string;
  detail: string;
};

export type HqCancelRequest = {
  id: string;
  tab: HqCancelStatus;
  memberNicknameMasked: string;
  storeLabel: string;
  faceValue: number;
  serviceTotal: number;
  redeemedAtLabel: string;
  reason: string;
  periodLocked: boolean;
  lockedPeriodLabel: string | null;
  subsidyAmount: number;
  pointsToReturn: number;
  rejectNote: string;
  timeline: HqTimelineEvent[];
};

export type HqSummaryCard = {
  key: string;
  label: string;
  value: string;
  hint: string;
};

export type HqGroomingSubsidyRow = {
  id: string;
  storeLabel: string;
  faceValue: number;
  redeemedAtLabel: string;
};

export type HqConsignmentRow = {
  id: string;
  storeLabel: string;
  skuLabel: string;
  commissionAmount: number;
  soldAtLabel: string;
};
