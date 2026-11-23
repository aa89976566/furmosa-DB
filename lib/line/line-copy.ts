/** LINE 對話按鈕與文案——台灣自然口吻，從不公司 */

export const LINE_BTN = {
  register: '開戶',
  registerNow: '立刻開戶',
  vault: '我的會員',
  enterCode: '輸入序號',
  jarExplain: '換罐說明',
  hubJar: '換罐計劃',
  hubChaos: '一起野放',
  hubWild: '回家',
  /** 舊鍵相容 */
  myCoupons: '我的優惠券',
  redeemGrooming: '兌換美容折價券',
  redeem: '兌換好康',
  activity: '一起野放',
  unboxing: '嗷嗚計劃',
  contact: '回家',
  confirm: '確認開戶',
  cancel: '重新填寫',
  speciesSkip: '先不填毛孩',
  redeemItem: (n: number) => `換贈品（${n}）`,
  confirmGroomingRedeem: '確認兌換',
} as const;

export const LINE_MENU_HINT_REGISTERED =
  '換罐計劃可以存罐；一起野放看看有什麼新鮮事；回家能逛官網跟 IG 喔。';

export const LINE_MENU_HINT_GUEST =
  '第一次來的話，先點「換罐計劃」→「開戶」，幫毛孩開好戶再玩會更順喔。';

export {
  SIGNUP_STORES as LINE_SIGNUP_STORES,
  SIGNUP_STORE_IDS as LINE_SIGNUP_STORE_CODES,
  resolveSignupStoreLabel,
  type SignupStoreId,
} from '@/lib/stores/signup-stores';

export const LINE_STORE_PROMPT =
  '請選一間常去的合作店家喔。之後換罐點數與 NT$200 折價券都會記在這間店。';

export const LINE_REGISTER_INTRO =
  '【開戶】先跟我們說一下你的暱稱～（例：小美）\n\n如果想先暫停，傳「取消」就可以。';

export const LINE_REGISTER_PHONE_PROMPT =
  '手機號碼可以留給我們嗎？（例：0912345678）\n這支用來核對資料，請填平常有在用的號碼喔。';

export const LINE_PET_NAME_PROMPT = '毛孩叫什麼名字呀？';

export const LINE_COUPON_VERIFY_HINT =
  '⚠️ 結帳前記得把券給店家看喔。\n店家按「驗證優惠券」後才能折抵。\n核銷過就不能再用了。';

export const LINE_CONTACT_INFO =
  '有任何問題直接在這串對話跟我們說，或去合作店現場問都可以喔。';

/** @deprecated */
export const LINE_ACTIVITY_INFO =
  '首罐不計點；交回完整空罐並完成到店換罐後，每罐累積 1 點。滿 10 點可在同一間店兌換 NT$200 折價券。';

/** @deprecated */
export const LINE_UNBOXING_INFO = `【嗷嗚計劃】

拍真實吃貨現場。交件標 @furmosa_food，
審核通過可拿下次購物金 NT$100。

回：我要參加嗷嗚`;
