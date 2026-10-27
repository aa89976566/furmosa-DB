/** Integer cents: cumulative allocation makes the last receipt absorb rounding. */
export function cumulativeShare(total: number, received: number, ordered: number) {
  if (![total, received, ordered].every(Number.isSafeInteger) || total < 0 || ordered <= 0 || received < 0 || received > ordered) {
    throw new Error('分批收貨數量或金額不正確');
  }
  return Number((BigInt(total) * BigInt(received)) / BigInt(ordered));
}
export type PartialReceiptLine = { lineId: string; quantityGrams: number };
export function normalizeReceiptLines(lines: PartialReceiptLine[]) {
  if (lines.length > 200 || new Set(lines.map(x => x.lineId)).size !== lines.length) throw new Error('收貨品項重複或過多');
  if (lines.some(x => !x.lineId || !Number.isSafeInteger(x.quantityGrams) || x.quantityGrams < 0)) throw new Error('實收克數必須為非負整數');
  const result = lines.filter(x => x.quantityGrams > 0).sort((a,b) => a.lineId.localeCompare(b.lineId));
  if (!result.length) throw new Error('請輸入至少一項本次實收數量');
  return result;
}
