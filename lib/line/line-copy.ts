/** LINE 對話按鈕與文案（台灣毛孩飼主口吻） */

export const LINE_BTN = {
  /** 主選單 */
  register: '幫毛孩開戶',
  vault: '罐罐存摺',
  redeem: '兌換好康',
  /** 註冊流程 */
  confirm: '確認加入',
  cancel: '重新填寫',
  speciesSkip: '先不填毛孩',
  /** 兌換 */
  redeemItem: (n: number) => `換贈品（${n}）`,
} as const;

export const LINE_MENU_HINT_REGISTERED =
  '點「罐罐存摺」看點數與存了幾罐，點「兌換好康」用點數換禮物。';

export const LINE_MENU_HINT_GUEST =
  '第一次請點「幫毛孩開戶」，在對話裡依序填寫就好。';

/** 換罐計畫開戶店家（LINE 開戶第一題） */
export const LINE_SIGNUP_STORES = [
  { code: 'zhuwo_zhonghe', label: '豬窩 中和店' },
  { code: 'zhuwo_banqiao', label: '豬窩 板橋店' },
  { code: 'zhuwo_tucheng', label: '豬窩 土城店' },
  { code: 'niuniu', label: '妞妞寵物美容' },
  { code: 'pet99', label: '99寵物美容' },
] as const;

export type SignupStoreCode = (typeof LINE_SIGNUP_STORES)[number]['code'];

export const LINE_SIGNUP_STORE_CODES = LINE_SIGNUP_STORES.map((s) => s.code);

export function resolveSignupStoreLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return LINE_SIGNUP_STORES.find((s) => s.code === code)?.label ?? null;
}

export const LINE_STORE_PROMPT = '請選擇您的開戶店家：';

export const LINE_REGISTER_INTRO =
  '【幫毛孩開戶】請輸入您的稱呼（例：王小姐）\n\n輸入「取消」可結束。';

export const LINE_PET_AGE_PROMPT =
  '毛孩大概幾歲？傳數字即可（例：3）\n或傳生日（例：2020-05-06）\n不確定可傳「略過」';
