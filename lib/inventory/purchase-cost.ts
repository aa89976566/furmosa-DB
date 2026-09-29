export type PurchaseCostLine = {
  productId: string;
  quantityGrams: number;
  rawAmountCents: number;
  openingAverageCostPerGram?: number | null;
  sourceLineId?: string;
};

export function parseMoneyToCents(value: FormDataEntryValue | null, label: string): number {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`${label}格式不正確`);
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error(`${label}超出範圍`);
  return cents;
}

/** 共同成本依原料金額比例分攤；尾差逐分配給餘數最大的品項，合計永遠完全相等。 */
export function allocateCommonCost(lines: PurchaseCostLine[], commonCostCents: number): number[] {
  if (!lines.length) throw new Error('至少需要一個進貨品項');
  if (!Number.isSafeInteger(commonCostCents)) throw new Error('共同成本格式不正確');
  const subtotal = lines.reduce((sum, line) => sum + line.rawAmountCents, 0);
  if (subtotal <= 0) throw new Error('商品金額合計必須大於 0');

  const sign = commonCostCents < 0 ? -1 : 1;
  const absolute = Math.abs(commonCostCents);
  const rows = lines.map((line, index) => {
    const numerator = absolute * line.rawAmountCents;
    return { index, cents: Math.floor(numerator / subtotal), remainder: numerator % subtotal };
  });
  let left = absolute - rows.reduce((sum, row) => sum + row.cents, 0);
  for (const row of [...rows].sort((a, b) => b.remainder - a.remainder || a.index - b.index)) {
    if (left <= 0) break;
    row.cents += 1;
    left -= 1;
  }
  return rows.sort((a, b) => a.index - b.index).map((row) => row.cents * sign);
}

export function movingAverageCost(input: {
  previousStockGrams: number;
  previousAverageCostPerGram: number;
  receivedGrams: number;
  landedAmountCents: number;
}): number {
  const { previousStockGrams, previousAverageCostPerGram, receivedGrams, landedAmountCents } = input;
  if (!Number.isSafeInteger(previousStockGrams) || previousStockGrams < 0) throw new Error('原庫存克數不正確');
  if (!Number.isSafeInteger(receivedGrams) || receivedGrams <= 0) throw new Error('實收克數必須大於 0');
  if (!Number.isFinite(previousAverageCostPerGram) || previousAverageCostPerGram < 0) throw new Error('原平均成本不正確');
  if (!Number.isSafeInteger(landedAmountCents) || landedAmountCents < 0) throw new Error('到岸成本不正確');
  return ((previousStockGrams * previousAverageCostPerGram) + landedAmountCents / 100) /
    (previousStockGrams + receivedGrams);
}
export function receiptAverageCost(input: {
  previousStockGrams: number;
  previousAverageCostPerGram: number;
  receivedGrams: number;
  landedAmountCents: number;
}): { resultingStockGrams: number; averageCostPerGram: number } {
  const resultingStockGrams = input.previousStockGrams + input.receivedGrams;
  if (resultingStockGrams < 0) throw new Error(`入庫後仍為 ${resultingStockGrams}g`);
  const averageCostPerGram = input.previousStockGrams < 0
    ? resultingStockGrams === 0
      ? 0
      : ((input.previousStockGrams * input.previousAverageCostPerGram) + input.landedAmountCents / 100) / resultingStockGrams
    : movingAverageCost(input);
  if (!Number.isFinite(averageCostPerGram) || averageCostPerGram < 0) throw new Error('入庫後成本異常');
  return { resultingStockGrams, averageCostPerGram };
}
