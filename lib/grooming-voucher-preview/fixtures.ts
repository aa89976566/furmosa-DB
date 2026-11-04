import { POS_STORE_LABEL } from './copy';
import type {
  FixtureKey,
  HqCancelRequest,
  HqConsignmentRow,
  HqGroomingSubsidyRow,
  HqSummaryCard,
  PreviewVoucher,
} from './types';

/** 固定預覽時間，避免畫面與測試漂移。 */
export const PREVIEW_NOW_LABEL = '2026/08/15 14:32';
export const PREVIEW_POS_STORE_ID = 'preview-store-east';
export const PREVIEW_OTHER_STORE_ID = 'preview-store-west';
export const PREVIEW_OTHER_STORE_LABEL = '預覽西區門市';
export const PREVIEW_POINTS_RETURN = 10;

const VOUCHERS: Record<FixtureKey, PreviewVoucher> = {
  available_200: {
    code: 'GV-PREVIEW-A200',
    kind: 'available',
    faceValue: 200,
    memberNicknameMasked: '阿**木',
    boundStoreId: PREVIEW_POS_STORE_ID,
    boundStoreLabel: POS_STORE_LABEL,
    expiresOn: '2026/09/04',
    statusLabel: '可核銷',
  },
  available_250: {
    code: 'GV-PREVIEW-A250',
    kind: 'available',
    faceValue: 250,
    memberNicknameMasked: '小**花',
    boundStoreId: PREVIEW_POS_STORE_ID,
    boundStoreLabel: POS_STORE_LABEL,
    expiresOn: '2026/09/10',
    statusLabel: '可核銷',
  },
  wrong_store: {
    code: 'GV-PREVIEW-WRONG',
    kind: 'wrong_store',
    faceValue: 200,
    memberNicknameMasked: '毛**球',
    boundStoreId: PREVIEW_OTHER_STORE_ID,
    boundStoreLabel: PREVIEW_OTHER_STORE_LABEL,
    expiresOn: '2026/09/01',
    statusLabel: '限他店',
  },
  expired: {
    code: 'GV-PREVIEW-EXPIRED',
    kind: 'expired',
    faceValue: 200,
    memberNicknameMasked: '阿**木',
    boundStoreId: PREVIEW_POS_STORE_ID,
    boundStoreLabel: POS_STORE_LABEL,
    expiresOn: '2026/07/20',
    statusLabel: '已過期',
  },
  already_redeemed: {
    code: 'GV-PREVIEW-USED',
    kind: 'already_redeemed',
    faceValue: 200,
    memberNicknameMasked: '小**花',
    boundStoreId: PREVIEW_POS_STORE_ID,
    boundStoreLabel: POS_STORE_LABEL,
    expiresOn: '2026/09/12',
    statusLabel: '已核銷',
  },
  offline: {
    code: 'GV-PREVIEW-OFFLINE',
    kind: 'offline',
    faceValue: 200,
    memberNicknameMasked: '阿**木',
    boundStoreId: PREVIEW_POS_STORE_ID,
    boundStoreLabel: POS_STORE_LABEL,
    expiresOn: '2026/09/08',
    statusLabel: '離線',
  },
};

export function getPreviewVoucher(key: FixtureKey): PreviewVoucher {
  return VOUCHERS[key];
}

export function listFixtureKeys(): FixtureKey[] {
  return Object.keys(VOUCHERS) as FixtureKey[];
}

export const HQ_SUMMARY_CARDS: HqSummaryCard[] = [
  { key: 'pending', label: '待審核', value: '2', hint: '取消申請等 HQ 決定' },
  { key: 'today', label: '今日核銷', value: '5', hint: '預覽日 8/15' },
  { key: 'payable', label: '待付補貼', value: 'NT$1,200', hint: '美容券固定補貼' },
  { key: 'reversal', label: '本期沖銷', value: 'NT$200', hint: '已核准取消' },
  { key: 'anomaly', label: '異常', value: '1', hint: '錯店嘗試（已擋）' },
  { key: 'locked', label: '已鎖帳期', value: '2026/07', hint: '舊期不重開' },
];

export const HQ_CANCEL_REQUESTS: HqCancelRequest[] = [
  {
    id: 'cxl-preview-01',
    tab: 'pending',
    memberNicknameMasked: '阿**木',
    storeLabel: POS_STORE_LABEL,
    faceValue: 200,
    serviceTotal: 880,
    redeemedAtLabel: '2026/08/15 11:08',
    reason: '顧客說美容師少做一項，店家同意重做但不想重收。',
    periodLocked: false,
    lockedPeriodLabel: null,
    subsidyAmount: 200,
    pointsToReturn: PREVIEW_POINTS_RETURN,
    rejectNote: '',
    timeline: [
      { atLabel: '2026/08/15 11:08', title: '門市核銷', detail: '服務總額 NT$880，補貼 NT$200' },
      { atLabel: '2026/08/15 13:40', title: '申請取消', detail: '店家送出爭議，待 HQ 審核' },
    ],
  },
  {
    id: 'cxl-preview-02',
    tab: 'pending',
    memberNicknameMasked: '小**花',
    storeLabel: POS_STORE_LABEL,
    faceValue: 250,
    serviceTotal: 1_260,
    redeemedAtLabel: '2026/07/28 16:22',
    reason: '當日機器故障，服務沒做完。',
    periodLocked: true,
    lockedPeriodLabel: '2026/07',
    subsidyAmount: 250,
    pointsToReturn: PREVIEW_POINTS_RETURN,
    rejectNote: '',
    timeline: [
      { atLabel: '2026/07/28 16:22', title: '門市核銷', detail: '服務總額 NT$1,260，補貼 NT$250' },
      { atLabel: '2026/08/02 09:10', title: '帳期鎖定', detail: '2026/07 已鎖，不再重開舊期' },
      { atLabel: '2026/08/15 10:05', title: '申請取消', detail: '店家補送爭議' },
    ],
  },
  {
    id: 'cxl-preview-03',
    tab: 'approved',
    memberNicknameMasked: '毛**球',
    storeLabel: PREVIEW_OTHER_STORE_LABEL,
    faceValue: 200,
    serviceTotal: 720,
    redeemedAtLabel: '2026/08/12 15:01',
    reason: '重複核銷，第二張應作廢。',
    periodLocked: false,
    lockedPeriodLabel: null,
    subsidyAmount: 200,
    pointsToReturn: PREVIEW_POINTS_RETURN,
    rejectNote: '',
    timeline: [
      { atLabel: '2026/08/12 15:01', title: '門市核銷', detail: '服務總額 NT$720' },
      { atLabel: '2026/08/13 09:20', title: '申請取消', detail: '重複核銷' },
      { atLabel: '2026/08/13 18:44', title: 'HQ 核准', detail: '退回 10 點、沖銷 NT$200，原券永久作廢' },
    ],
  },
  {
    id: 'cxl-preview-04',
    tab: 'rejected',
    memberNicknameMasked: '阿**木',
    storeLabel: POS_STORE_LABEL,
    faceValue: 200,
    serviceTotal: 640,
    redeemedAtLabel: '2026/08/10 12:18',
    reason: '顧客事後反悔，服務已完成。',
    periodLocked: false,
    lockedPeriodLabel: null,
    subsidyAmount: 200,
    pointsToReturn: PREVIEW_POINTS_RETURN,
    rejectNote: '服務已完成，不接受事後反悔。',
    timeline: [
      { atLabel: '2026/08/10 12:18', title: '門市核銷', detail: '服務總額 NT$640' },
      { atLabel: '2026/08/11 08:50', title: '申請取消', detail: '顧客事後反悔' },
      { atLabel: '2026/08/11 17:02', title: 'HQ 拒絕', detail: '服務已完成，不接受事後反悔。' },
    ],
  },
];

export const HQ_GROOMING_SUBSIDY_ROWS: HqGroomingSubsidyRow[] = [
  { id: 'sub-preview-01', storeLabel: POS_STORE_LABEL, faceValue: 200, redeemedAtLabel: '2026/08/15 11:08' },
  { id: 'sub-preview-02', storeLabel: POS_STORE_LABEL, faceValue: 250, redeemedAtLabel: '2026/08/15 12:41' },
  { id: 'sub-preview-03', storeLabel: PREVIEW_OTHER_STORE_LABEL, faceValue: 200, redeemedAtLabel: '2026/08/15 13:05' },
];

export const HQ_CONSIGNMENT_ROWS: HqConsignmentRow[] = [
  {
    id: 'csg-preview-01',
    storeLabel: POS_STORE_LABEL,
    skuLabel: '預覽凍乾・試作包',
    commissionAmount: 36,
    soldAtLabel: '2026/08/15 10:20',
  },
  {
    id: 'csg-preview-02',
    storeLabel: PREVIEW_OTHER_STORE_LABEL,
    skuLabel: '預覽肉乾・試作包',
    commissionAmount: 24,
    soldAtLabel: '2026/08/15 11:55',
  },
];
