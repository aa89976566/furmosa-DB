type FormLine = {
  productId: string;
  tierId: string;
  quantity: number;
  unitPrice: number;
  weightGrams: number | null;
  unit: string | null;
  isGift: boolean;
  commercialOverrideEnabled?: boolean;
  commercialOverrideMode?: string;
  commercialOverrideValue?: number | null;
  commercialOverrideReason?: string;
};

/** Conditional UI controls must not determine the alignment of submitted lines. */
export function writeOrderFormLines(form: FormData, lines: FormLine[]) {
  const fields = ['productId', 'tierId', 'quantity', 'unitPrice', 'weightGrams', 'unit',
    'giftWeightGrams', 'lineIsGift', 'commercialOverrideMode',
    'commercialOverrideValue', 'commercialOverrideReason'] as const;
  for (const field of fields) form.delete(field);
  for (const line of lines.filter((item) => item.productId)) {
    const values = [line.productId, line.tierId, line.quantity, line.isGift ? 0 : line.unitPrice,
      line.weightGrams ?? '', line.unit ?? '', line.isGift ? line.weightGrams ?? '' : '',
      line.isGift ? '1' : '0',
      line.commercialOverrideEnabled ? line.commercialOverrideMode ?? '' : '',
      line.commercialOverrideEnabled ? line.commercialOverrideValue ?? '' : '',
      line.commercialOverrideEnabled ? line.commercialOverrideReason ?? '' : ''];
    fields.forEach((field, index) => form.append(field, String(values[index])));
  }
}
