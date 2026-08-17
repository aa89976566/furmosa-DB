/** Bark 台灣語境文案。純展示，不連後端。 */

export const PREVIEW_BANNER = '互動預覽・不會寫入正式資料';

export const POS_TASK_TITLE = '核銷美容券';
export const POS_TASK_SUBTITLE = '掃券、對總額、做完再核銷';

export const POS_STORE_LABEL = '預覽東區門市';

export const POS_TEST_TOOLS_TITLE = '測試工具';
export const POS_TEST_TOOLS_NOTE = '這塊只在預覽出現，正式 POS 不會有。';
export const POS_STEP_SCAN = '掃描券碼';
export const POS_STEP_CONFIRM = '確認服務';
export const POS_STEP_DONE = '完成';
export const POS_SCAN_QR = '掃描 QR Code';
export const POS_MANUAL_CODE = '手動輸入券碼';
export const POS_READ_CODE = '讀取券';
export const POS_CONFIRM_DATA = '確認資料';
export const POS_AMOUNT_LABEL = '美容服務總額';

export const COPY = {
  wrongStore: '這張券不歸本店，先別硬刷。請顧客回綁定門市使用。',
  expired: '這張券過期了，沒辦法核銷。',
  alreadyRedeemed: '這張券已經用過了，不能再刷一次。',
  offline: '現在離線，先別核銷。這次不會排隊、也不會寫入。',
  amountNotGreater: (faceValue: number) => `美容服務總額要高於 NT$${faceValue}。`,
  invalidAmount: '本次美容服務總額要填整數，而且不能空白。',
  serviceNotConfirmed: '服務還沒勾，先確認做完再核銷。',
  duplicateSubmit: '這筆已經送出了，別連點。',
  codeRequired: '先掃券，或改手動輸入。',
  cancelReasonRequired: '取消理由要寫清楚，HQ 才審得下去。',
  cancelSubmitted: '已送 HQ 審核。券不會回到未使用。',
  storeCannotCancel: '店家這邊不能自己取消核銷。送出後由 HQ 審。',
  furmosaSubsidy: (amount: number) => `Furmosa 固定補貼 NT$${amount}`,
  reviewHint: '核銷後這張券就用掉了。店家不能自行取消。',
  confirmRedeem: '確認完成服務並核銷',
  applyCancel: '申請取消',
  lockedPeriod: '將列入下一期調整',
  approveConfirm: (subsidy: number) =>
    `核准後會退回 10 點、沖銷 NT$${subsidy}，原券永久作廢。`,
  rejectNoteRequired: '拒絕要寫一句備註，之後才對得上。',
} as const;

export const FIXTURE_LABELS: Record<
  import('./types').FixtureKey,
  string
> = {
  available_200: '可用 200',
  available_250: '可用 250',
  wrong_store: '錯店',
  expired: '已過期',
  already_redeemed: '已核銷',
  offline: '離線',
};

export const HQ_TAB_LABELS = {
  pending: '待審核',
  approved: '已核准',
  rejected: '已拒絕',
} as const;
