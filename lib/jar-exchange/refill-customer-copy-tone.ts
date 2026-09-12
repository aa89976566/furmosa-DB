/**
 * 換罐計畫 — 顧客文案語氣規則（SSOT）
 *
 * 所有顧客可見換罐文案（加入前／五態／FAQ／口味說明）必須遵守。
 * HQ Preview 標示可保留 Preview 字樣，但不可暗示已上線核銷。
 */

export const REFILL_CUSTOMER_COPY_TONE = {
  summary:
    '台灣飼主自然口語；Bark＝狗狗觀察力、機靈、帶一點乾幽默；成熟不幼稚。',
  rules: [
    '句子短、順，第一次讀就懂。',
    '不用「小管家」、不連續喊「汪」、不濫用波浪號、驚嘆號或 emoji。',
    '可以偶爾用「毛孩」「下一罐在等你」「走原路回店」，但每則最多一個比喻。',
    '先說顧客要知道的結果，再說期限／店家。',
    '不寫官腔：例如「完成核銷」「資格派生」「不可直接領取新品」「資格自確認起」。',
    '重要規則要準確：第一罐 NT$129、空瓶回序號所屬原店、下一罐不同口味 NT$99、30 天、每罐 1 點、10 點折 NT$200、口味依原店庫存。',
    '不保證有指定口味，不暗示跨店，不把 Preview 當已上線。',
    '一空瓶對應一組 NT$99 期限；過期後需再帶空瓶、店家確認後開新期限，不是舊資格「重新啟用」。',
  ],
} as const;

/** 顧客文案語氣守門：命中即不合格（僅掃顧客可見字串） */
export const REFILL_CUSTOMER_COPY_FORBIDDEN = [
  { id: '小管家', pattern: /小管家/ },
  { id: '連續汪', pattern: /汪{2,}|汪[！!]?\s*汪/ },
  { id: '過度波浪', pattern: /～{2,}|~{2,}/ },
  { id: '官腔-完成核銷', pattern: /完成核銷/ },
  { id: '官腔-資格派生', pattern: /資格派生/ },
  { id: '官腔-不可直接領取', pattern: /不可直接領取/ },
  { id: '官腔-資格自確認起', pattern: /資格自確認起/ },
] as const;

export function findRefillCustomerCopyToneViolations(
  texts: string[],
): Array<{ id: string; sample: string }> {
  const hits: Array<{ id: string; sample: string }> = [];
  for (const text of texts) {
    for (const rule of REFILL_CUSTOMER_COPY_FORBIDDEN) {
      if (rule.pattern.test(text)) {
        hits.push({ id: rule.id, sample: text.slice(0, 80) });
      }
    }
  }
  return hits;
}
