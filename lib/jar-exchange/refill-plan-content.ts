/**
 * 換罐計劃正式內容（單一來源）。
 * LINE Flex／FAQ／後台說明都讀這裡，避免規則散落。
 */

export const REFILL_PLAN_RULES = {
  brandName: '匠寵 FURMOSA',
  concept: '吃完不是結束，帶回空罐，再換一種口味。',
  firstJarPrice: 129,
  exchangePrice: 99,
  /** 必須一罐空罐換一罐新品 */
  oneForOneRequired: true,
  /** 口味／庫存更新節奏文案 */
  flavourUpdateCadence: '依合作店實際供應狀況更新',
  stockDisclaimer: '依合作店當期庫存為準',
  serialDigits: 8,
  pointsPerJar: 1,
  pointsForDiscount: 10,
  /** 預設折抵；實際綁定店可能為豬窩 250，顯示時再依店家覆寫 */
  discountAmountDefault: 200,
  heroImagePath: '/images/refill-plan/refill-flavours-v2.jpg',
  heroAlt: '匠寵換罐計劃口味介紹',
} as const;

export type RefillPlanFaqItem = {
  id: string;
  question: string;
  answer: string;
};

/** 常見問題（正式規則） */
export const REFILL_PLAN_FAQ: RefillPlanFaqItem[] = [
  {
    id: 'price-first',
    question: '第一罐多少錢？',
    answer: '第一罐 NT$129，不用帶空罐。',
  },
  {
    id: 'price-exchange',
    question: '換罐多少錢？',
    answer: '吃完後帶回一個完整的匠寵空罐並完成到店換罐，就能用 NT$99 續罐；可改選店家當期供應的其他口味。',
  },
  {
    id: 'no-empty',
    question: '可以不帶空罐嗎？',
    answer: '換罐價必須完成一罐換一罐。沒帶空罐時，不可直接以 NT$99 領取新品。',
  },
  {
    id: 'choose-flavour',
    question: '可以自己選口味嗎？',
    answer: '可以從所選店家當期可供應的品項中選擇，實際可預購品項以換罐頁為準。',
  },
  {
    id: 'serial-where',
    question: '序號在哪裡？',
    answer: '每個罐底都有一組 8 位數字序號。',
  },
  {
    id: 'how-points',
    question: '如何集點？',
    answer: '首罐不計點；交回完整空罐並完成到店換罐後，每罐累積 1 點。',
  },
  {
    id: 'ten-points',
    question: '集滿 10 點可以做什麼？',
    answer: '可在累積點數的同一間合作店家兌換 NT$200 店家折價券。',
  },
  {
    id: 'points-share',
    question: '不同店家的點數可以共用嗎？',
    answer: '不共用。點數與折價券限在累積點數的同一間店家使用。',
  },
  {
    id: 'all-seven',
    question: '目前有哪些換罐口味？',
    answer: '目前介紹三款：棒棒牛、棒棒雞、脆脆鴨。實際可預購品項以換罐頁為準。',
  },
];

export const REFILL_INTRO_COPY = {
  flexTitle: '換罐計畫',
  flavourSectionTitle: '目前可預購的換罐品項',
  priceHeadline: '第一罐 NT$129；帶完整空罐續罐 NT$99',
  pointsHeadline: '到店換罐，每罐累積 1 點',
  pointsReward: '集滿 10 點，兌換 NT$200 店家折價券',
  notes: [
    '首罐不計點；交回完整空罐、完成換罐後才入點',
    '點數與折價券限同一間店家使用',
    '棒棒牛、脆脆鴨含鴨肉；棒棒雞不含鴨',
  ] as const,
  altText:
    '換罐計畫｜第一罐 NT$129，不用帶空罐；吃完帶完整空罐回原店，棒棒牛、棒棒雞、脆脆鴨可依供應口味用 NT$99 續罐。完成到店換罐每罐累積 1 點，集滿 10 點兌換 NT$200 店家折價券（首罐不計點）。',
  ctaStart: '線上預購換罐',
  ctaFlavours: '看本期口味',
  ctaStores: '查看合作店',
} as const;

/** LINE 對外介紹用的三款換罐內容；不參與 SKU、庫存或資格判斷。 */
export const REFILL_INTRO_PRODUCTS = [
  {
    name: '棒棒牛',
    size: '5條／罐',
    description: '鴨喉嚨包覆牛肉，外層裹蔬菜凍乾',
  },
  {
    name: '棒棒雞',
    size: '5條／罐',
    description: '雞肉加蔬菜凍乾打成泥，低溫烘乾',
  },
  {
    name: '脆脆鴨',
    size: '27g／罐',
    description: '鴨喉 12g＋鴨肺 15g，低溫烘烤',
  },
] as const;

/** 舊版預設口味（seed／後備；正式顯示以 DB isActive 為準） */
export const DEFAULT_REFILL_FLAVOURS = [
  { code: 'veggie-25', name: '蔬果凍乾', weightGrams: 25, sortOrder: 1 },
  { code: 'beef-20', name: '牛肉凍乾', weightGrams: 20, sortOrder: 2 },
  { code: 'chicken-20', name: '雞肉凍乾', weightGrams: 20, sortOrder: 3 },
  { code: 'crystal-fish-10', name: '水晶魚凍乾', weightGrams: 10, sortOrder: 4 },
  { code: 'anchovy-15', name: '丁香魚凍乾', weightGrams: 15, sortOrder: 5 },
  { code: 'duck-throat-15', name: '鴨喉嚨凍乾', weightGrams: 15, sortOrder: 6 },
  { code: 'pig-ear-30', name: '豬耳朵條', weightGrams: 30, sortOrder: 7 },
] as const;

export function formatFlavourLabel(name: string, weightGrams: number): string {
  return `${name}｜${formatRefillSize(weightGrams)}`;
}

/** 0 is the persisted “weight not specified” marker, never a physical gram quantity.
 * Refill stock and delivery always count jars, independently of this display field.
 */
export function formatRefillSize(weightGrams: number): string {
  return Number.isFinite(weightGrams) && weightGrams > 0 ? `${weightGrams}g` : '1罐';
}

export function parseOptionalRefillWeight(value: FormDataEntryValue | null): number | null {
  if (value === null || (typeof value === 'string' && value.trim() === '')) return 0;
  if (typeof value !== 'string') return null;
  const grams = Number(value);
  return Number.isSafeInteger(grams) && grams >= 0 ? grams : null;
}
