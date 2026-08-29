/**
 * 換罐計畫正式內容（單一來源）。
 * LINE Flex／FAQ／後台說明都讀這裡，避免規則散落。
 *
 * 顧客文案語氣：見 lib/jar-exchange/refill-customer-copy-tone.ts
 * — 台灣飼主自然口語、Bark 感、成熟不幼稚；規則必須準確。
 */

import {
  REFILL_EXCHANGE_WINDOW_DAYS,
  REFILL_EXPIRY_REMINDER_DAYS,
} from '@/lib/refill/exchange-window';

export const REFILL_PLAN_RULES = {
  brandName: '匠寵 FURMOSA',
  concept: '這罐吃完，先別急著說再見。帶回空瓶，再換一種口味。',
  firstJarPrice: 129,
  exchangePrice: 99,
  /** 必須一罐空罐換一罐新品 */
  oneForOneRequired: true,
  /** 口味／庫存更新節奏文案 */
  flavourUpdateCadence: '每兩週更新',
  stockDisclaimer: '口味以原店當天庫存為準',
  serialDigits: 8,
  pointsPerJar: 1,
  pointsForDiscount: 10,
  /** 預設折抵；實際綁定店可能為豬窩 250，顯示時再依店家覆寫 */
  discountAmountDefault: 200,
  heroImagePath: '/images/refill-plan/refill-flavours-v2.jpg',
  heroAlt: '匠寵換罐計畫七種零食口味',
  /** 與 lib/refill/exchange-window.ts SSOT 對齊 */
  exchangeWindowDays: REFILL_EXCHANGE_WINDOW_DAYS,
  expiryReminderDays: REFILL_EXPIRY_REMINDER_DAYS,
} as const;

export type RefillPlanFaqItem = {
  id: string;
  question: string;
  answer: string;
};

/** 常見問題（正式規則・顧客口語） */
export const REFILL_PLAN_FAQ: RefillPlanFaqItem[] = [
  {
    id: 'price-first',
    question: '第一罐多少錢？',
    answer: '第一罐 NT$129，先讓毛孩試試口味。',
  },
  {
    id: 'price-exchange',
    question: '換罐多少錢？',
    answer: `空瓶交回序號所屬原店、店家確認後，下一罐不同口味 NT$99；請在 ${REFILL_EXCHANGE_WINDOW_DAYS} 天內換完。`,
  },
  {
    id: 'exchange-window',
    question: '換口味有期限嗎？',
    answer: `有。空瓶交回原店、店家確認後，記得在 ${REFILL_EXCHANGE_WINDOW_DAYS} 天內回同一間店換罐；啟用後會看到最晚使用日。`,
  },
  {
    id: 'home-store',
    question: '可以跨店換罐嗎？',
    answer:
      '現在還不行。空瓶要帶回序號所屬原店；每間店的庫存和紀錄各自管理，走原路回去才不會對錯帳。',
  },
  {
    id: 'no-empty',
    question: '可以不帶空罐嗎？',
    answer: '不行喔。NT$99 是「一罐空瓶換一罐新品」；沒帶空瓶，就還是要用一般價格買。',
  },
  {
    id: 'choose-flavour',
    question: '可以自己選口味嗎？',
    answer: '可以，從原店當天有貨的口味裡挑。各店品項大概每兩週會調整一次。',
  },
  {
    id: 'serial-where',
    question: '序號在哪裡？',
    answer: '每個罐底都有一組 8 位數字序號。',
  },
  {
    id: 'how-points',
    question: '如何集點？',
    answer: '先幫毛孩開好帳號，再到官方 LINE 輸入罐底序號；每個有效序號存 1 點。',
  },
  {
    id: 'ten-points',
    question: '集滿 10 點可以做什麼？',
    answer: '可以在帳號綁定的合作美容店，折抵 NT$200 美容費。',
  },
  {
    id: 'points-share',
    question: '不同店家的點數可以共用嗎？',
    answer: '折價看你帳號綁定的合作店；開戶完成後會顯示綁定哪一間。',
  },
  {
    id: 'all-seven',
    question: '每間店都有七種口味嗎？',
    answer: '不一定。七種是目前系列，實際能選哪些，以各合作店當天庫存為準。',
  },
];

export type RefillIntroStep = {
  no: string;
  title: string;
  body: string;
};

/** 流程步驟文案（完整規則／流程卡用；不塞進加入前主卡） */
export const REFILL_INTRO_STEPS: RefillIntroStep[] = [
  {
    no: '01',
    title: '先帶一罐回家',
    body: '第一罐 NT$129，先讓毛孩試試口味。',
  },
  {
    no: '02',
    title: '吃完帶回原店',
    body: '空瓶帶回序號所屬原店；現在還不能跨店。',
  },
  {
    no: '03',
    title: 'NT$99 換新口味',
    body: `店家確認空瓶後，請在 ${REFILL_EXCHANGE_WINDOW_DAYS} 天內換完。`,
  },
  {
    no: '04',
    title: '輸入瓶底序號',
    body: '每罐再存 1 點，集滿 10 點折 NT$200 美容費。',
  },
];

/**
 * 加入前主卡文案（顧客決策卡 SSOT）。
 * 完整步驟／七口味清單／合作店仍走既有 FAQ／口味／合作店回覆，不刪底層資料。
 */
export const REFILL_INTRO_COPY = {
  flexTitle: '匠寵換罐計畫',
  headline: '這罐吃完，先別急著說再見。',
  /** 主卡核心資訊（不含 30 天醒目區；該區走 exchange-window SSOT） */
  bodyLines: [
    '第一罐 NT$129，先讓毛孩試試口味。',
    '吃完把空瓶帶回原店，下一罐不同口味 NT$99。',
    '每罐再存 1 點，集滿 10 點折 NT$200 美容費。',
    '想換哪一味，到店看現場庫存最準。',
  ],
  /** 口味回覆專用（不進加入前主卡） */
  flavourSectionTitle: '這期想吃哪一罐？',
  flavourSectionLead: [
    '目前系列有 7 種口味，',
    '各合作店大概每兩週會調整一次。',
    '',
    '實際能選哪些，到店看現場庫存最準。',
  ],
  /** CTA：按鈕標籤 vs 實際送出的 message text（本輪不改） */
  ctaJoinLabel: '我要參加',
  ctaJoinMessage: '開始換罐',
  ctaFlavoursLabel: '先看口味',
  ctaFlavoursMessage: '看本期口味',
  ctaRulesLabel: '查看完整規則',
  ctaRulesMessage: '換罐規則',
  /** 口味／FAQ 等次要回覆仍可用 */
  ctaStores: '查看合作店',
} as const;

/** 預設七種口味（seed／後備；正式顯示以 DB isActive 為準） */
export const DEFAULT_REFILL_FLAVOURS = [
  { code: 'veggie-25', name: '蔬果凍乾', weightGrams: 25, sortOrder: 1 },
  { code: 'beef-20', name: '牛肉凍乾', weightGrams: 20, sortOrder: 2 },
  { code: 'chicken-20', name: '雞肉凍乾', weightGrams: 20, sortOrder: 3 },
  { code: 'crystal-fish-10', name: '水晶魚凍乾', weightGrams: 10, sortOrder: 4 },
  { code: 'anchovy-15', name: '丁香魚凍乾', weightGrams: 15, sortOrder: 5 },
  { code: 'duck-throat-15', name: '鴨喉嚨凍乾', weightGrams: 15, sortOrder: 6 },
  { code: 'pig-ear-30', name: '豬耳朵凍乾', weightGrams: 30, sortOrder: 7 },
] as const;

export function formatFlavourLabel(name: string, weightGrams: number): string {
  return `${name}｜${weightGrams}g`;
}
