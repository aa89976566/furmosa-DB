export const JIBA_CAMPAIGN_SLUG = 'jiba-two-piece';
export const JIBA_LICENSE_VERSION = 'ugc-v1';
export const JIBA_SHIPPING_FEE = 60;

/** 小幫手／審核者顯示名 */
export const JIBA_SUPERVISOR_NAME = '壽司匠';

/** 運費轉帳（無線上金流） */
export const JIBA_BANK_TRANSFER = {
  bankName: '中國信託',
  bankCode: '822',
  account: '226540037896',
} as const;

export const APP_STATUS = {
  COLLECTING_INFO: 'COLLECTING_INFO',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  AWAITING_SHIPPING_PAYMENT: 'AWAITING_SHIPPING_PAYMENT',
  READY_TO_SHIP: 'READY_TO_SHIP',
  REJECTED: 'REJECTED',
  CANCELLED_BY_USER: 'CANCELLED_BY_USER',
  CANCELLED: 'CANCELLED',
} as const;

export type AppStatus = (typeof APP_STATUS)[keyof typeof APP_STATUS];

export const FLOW_STATE = {
  CAMPAIGN_INTRO: 'CAMPAIGN_INTRO',
  SHOW_RULES: 'SHOW_RULES',
  /** 選開箱商品：雞霸兩片／青蛙凍乾一隻／貓草雞肉乾 30g */
  ASK_PRODUCT: 'ASK_PRODUCT',
  /** 選完商品：投稿事項＋加購免運說明 */
  SHOW_BRIEF: 'SHOW_BRIEF',
  ASK_RECIPIENT_NAME: 'ASK_RECIPIENT_NAME',
  ASK_RECIPIENT_PHONE: 'ASK_RECIPIENT_PHONE',
  ASK_STORE: 'ASK_STORE',
  CONFIRM_STORE: 'CONFIRM_STORE',
  ASK_INSTAGRAM: 'ASK_INSTAGRAM',
  ASK_PET_NAME: 'ASK_PET_NAME',
  ASK_CONTENT_LICENSE: 'ASK_CONTENT_LICENSE',
  SHOW_ORDER_CONFIRMATION: 'SHOW_ORDER_CONFIRMATION',
  EDIT_FIELD_SELECTION: 'EDIT_FIELD_SELECTION',
  PENDING_REVIEW: 'PENDING_REVIEW',
  AWAITING_SHIPPING_PAYMENT: 'AWAITING_SHIPPING_PAYMENT',
  READY_TO_SHIP: 'READY_TO_SHIP',
  CANCELLED: 'CANCELLED',
} as const;

export type FlowState = (typeof FLOW_STATE)[keyof typeof FLOW_STATE];

/** 貓草雞肉乾用途說明（僅文案；不改 catnip-chick 網站） */
export const CATNIP_CHICK_HOMEPAGE_URL = 'https://catnip-chick.vercel.app/?cat=1';

/** 開箱可選商品（存 collectedDataJson.productKey） */
export const JIBA_PRODUCTS = {
  jiba: {
    key: 'jiba',
    label: '壕大大雞霸兩片',
    shortLabel: '壕大大雞霸',
    quantity: 2,
    unit: '片',
    orderLabel: '壕大大雞霸 × 2',
  },
  frog: {
    key: 'frog',
    label: '青蛙凍乾一隻',
    shortLabel: '青蛙凍乾',
    quantity: 1,
    unit: '隻',
    orderLabel: '青蛙凍乾 × 1',
  },
  catnip: {
    key: 'catnip',
    label: '貓草雞肉乾 30g',
    shortLabel: '貓草雞肉乾',
    quantity: 1,
    unit: '包',
    orderLabel: '貓草雞肉乾 30g',
  },
} as const;

export type JibaProductKey = keyof typeof JIBA_PRODUCTS;

export function isJibaProductKey(value: unknown): value is JibaProductKey {
  return typeof value === 'string' && value in JIBA_PRODUCTS;
}

/** LINE 選品按鈕顯示名（與資料模型 label 分開，避免手打進姓名欄） */
export const JIBA_PRODUCT_BUTTON_LABEL = {
  jiba: '雞霸',
  frog: '青蛙',
  catnip: '貓草雞肉乾 30g',
} as const;

/** LINE message action payload：加「選」前綴，避免被姓名驗證誤收 */
export const JIBA_PRODUCT_ACTION_TEXT = {
  jiba: '選雞霸',
  frog: '選青蛙',
  catnip: '選貓草雞肉乾',
} as const;

/** LINE 按鈕／打字選商品 */
export function parseJibaProductKey(text: string): JibaProductKey | null {
  const t = text.trim();
  if (/^(?:選雞霸兩片|選雞霸|壕大大雞霸兩片|壕大大雞霸|雞霸兩片|雞霸)$/i.test(t)) {
    return 'jiba';
  }
  if (/^(?:選青蛙凍乾|選青蛙|青蛙凍乾一隻|青蛙凍乾|青蛙)$/i.test(t)) return 'frog';
  if (/^(?:選貓草雞肉乾(?:\s*30g)?|貓草雞肉乾\s*30g?|貓草雞肉乾|貓草)$/i.test(t)) {
    return 'catnip';
  }
  return null;
}

export function parseCollectedDataJson(
  json: string | null | undefined,
): Record<string, unknown> {
  try {
    return JSON.parse(json || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function jibaProductKeyFromCollected(
  data: Record<string, unknown> | string | null | undefined,
): JibaProductKey {
  const parsed = typeof data === 'string' || data == null ? parseCollectedDataJson(data) : data;
  const key = parsed.productKey;
  return isJibaProductKey(key) ? key : 'jiba';
}

export function jibaProductLabelFromCollected(
  data: Record<string, unknown> | string | null | undefined,
): string {
  return JIBA_PRODUCTS[jibaProductKeyFromCollected(data)].orderLabel;
}

/** 限時加購免運門檻（說明用） */
export const JIBA_FREE_SHIP = {
  cvs711: 399,
  blackCat: 886,
} as const;

export const ACTIVE_APP_STATUSES = [
  APP_STATUS.COLLECTING_INFO,
  APP_STATUS.PENDING_REVIEW,
  APP_STATUS.APPROVED,
  APP_STATUS.AWAITING_SHIPPING_PAYMENT,
] as const;

/** 正面參加意圖 */
export const JOIN_INTENT_RE =
  /^(?:我要參加|要|可以|好|來吧|我想參加|怎麼參加|算我一個|敢|敢，來吧|這個我可以！|\+1|yes)$/i;

export const DECLINE_RE = /^(?:這次先不要|不要|先不要|我再想一下|先不用|先不要送出)$/i;
