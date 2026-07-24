/** LINE 對話按鈕與文案（台灣毛孩飼主口吻） */

export const LINE_BTN = {
  /** 三世界／換罐 */
  register: '幫毛孩開戶',
  registerNow: '立即開戶',
  vault: '毛孩罐庫',
  enterCode: '輸入序號',
  jarExplain: '什麼是換罐',
  hubJar: '換罐計畫',
  hubChaos: '一起搞事',
  hubWild: '野放中',
  /** 舊鍵相容（部分流程仍引用） */
  myCoupons: '我的優惠券',
  redeemGrooming: '兌換美容折價券',
  redeem: '兌換好康',
  activity: '一起搞事',
  unboxing: '嗷嗚計畫',
  contact: '野放中',
  /** 註冊流程 */
  confirm: '確認開戶',
  cancel: '重新填寫',
  speciesSkip: '先不填毛孩',
  /** 兌換 */
  redeemItem: (n: number) => `換贈品（${n}）`,
  confirmGroomingRedeem: '確認兌換',
} as const;

export const LINE_MENU_HINT_REGISTERED =
  '換罐計畫存罐；一起搞事看正在搞什麼；野放中晃官網社群。';

export const LINE_MENU_HINT_GUEST =
  '第一次先點「換罐計畫」→「幫毛孩開戶」。沒開戶不能存罐。';

export {
  SIGNUP_STORES as LINE_SIGNUP_STORES,
  SIGNUP_STORE_IDS as LINE_SIGNUP_STORE_CODES,
  resolveSignupStoreLabel,
  type SignupStoreId,
} from '@/lib/stores/signup-stores';

export const LINE_STORE_PROMPT =
  '選一間常去的美容合作店。之後折價券綁這間用（豬窩 250、其他店 200）。';

export const LINE_REGISTER_INTRO =
  '【幫毛孩開戶】先暱稱一下你自己（例：王小姐）\n\n傳「取消」可結束。';

export const LINE_REGISTER_PHONE_PROMPT =
  '手機號碼？（例：0912345678）\n這支用來對資料，請填真的。';

export const LINE_PET_NAME_PROMPT = '毛孩叫什麼名字？';

export const LINE_PET_BREED_PROMPT =
  '品種？（例：柯基、米克斯）\n不確定可傳「略過」';

export const LINE_PET_BIRTHDAY_PROMPT =
  '生日？（例：2020-05-06）\n選填，可傳「略過」';

export const LINE_PET_AGE_PROMPT =
  '毛孩大概幾歲？傳數字即可（例：3）\n或傳生日（例：2020-05-06）\n不確定可傳「略過」';

export const LINE_COUPON_VERIFY_HINT =
  '⚠️ 結帳前把券給店家看。\n店家按「驗證優惠券」後才能折。\n核銷過就不能再用。';

export const LINE_CONTACT_INFO = '有事直接在這串對話講，或去合作店現場問。';

/** @deprecated 改走 brand-worlds JAR_EXPLAIN_TEXT */
export const LINE_ACTIVITY_INFO =
  '空罐序號入帳得點數。滿 10 點可換美容折價：豬窩 250、其他合作店 200。';

/** @deprecated 改走 brand-worlds CHAOS_COPY */
export const LINE_UNBOXING_INFO = `【嗷嗚計畫】

拍真實吃貨現場。依拍攝指南交件，
審核通過可拿下次購物金 NT$100。

回：我要參加嗷嗚`;
