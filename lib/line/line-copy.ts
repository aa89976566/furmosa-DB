/** LINE 對話按鈕與文案（台灣毛孩飼主口吻） */

export const LINE_BTN = {
  /** 主選單 */
  register: '幫毛孩開戶',
  vault: '我的點數',
  myCoupons: '我的優惠券',
  redeemGrooming: '兌換美容折250元',
  redeem: '兌換好康',
  activity: '活動辦法',
  contact: '聯絡客服',
  /** 註冊流程 */
  confirm: '確認加入',
  cancel: '重新填寫',
  speciesSkip: '先不填毛孩',
  /** 兌換 */
  redeemItem: (n: number) => `換贈品（${n}）`,
  confirmGroomingRedeem: '確認兌換',
} as const;

export const LINE_MENU_HINT_REGISTERED =
  '「我的點數」看餘額；「我的優惠券」查看券；滿 10 點可兌換美容折 250 元。';

export const LINE_MENU_HINT_GUEST =
  '第一次請點「幫毛孩開戶」，在對話裡依序填寫就好。';

export {
  SIGNUP_STORES as LINE_SIGNUP_STORES,
  SIGNUP_STORE_IDS as LINE_SIGNUP_STORE_CODES,
  resolveSignupStoreLabel,
  type SignupStoreId,
} from '@/lib/stores/signup-stores';

export const LINE_STORE_PROMPT = '請選擇您的開戶店家：';

export const LINE_REGISTER_INTRO =
  '【幫毛孩開戶】請輸入您的稱呼（例：王小姐）\n\n輸入「取消」可結束。';

export const LINE_PET_AGE_PROMPT =
  '毛孩大概幾歲？傳數字即可（例：3）\n或傳生日（例：2020-05-06）\n不確定可傳「略過」';

export const LINE_COUPON_VERIFY_HINT =
  '⚠️ 請於結帳前出示此優惠券給店家。\n店家需按下「驗證優惠券」確認後方可折抵。\n優惠券一經核銷即無法再次使用。';

export const LINE_CONTACT_INFO = '如需協助請私訊官方帳號，或至合作店家現場詢問。';

export const LINE_ACTIVITY_INFO =
  '【換罐存點】空罐序號入帳得點數。\n【美容折價券】累積 10 點可兌換 250 元折價券，限綁定店家使用，有效 30 天。';
