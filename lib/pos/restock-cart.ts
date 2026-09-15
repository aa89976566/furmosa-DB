export type RestockCartLine = {
  productId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  variantKey?: string | null;
  weightGrams?: number | null;
  variantLabel?: string;
};

export function restockCartLineKey(line: Pick<RestockCartLine, 'productId' | 'variantKey'>): string {
  return line.variantKey ? JSON.stringify([line.productId, line.variantKey]) : line.productId;
}

export function restockCartTotalPieces(lines: RestockCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function defaultRestockAddQty(suggestedQty: number): number {
  const suggested = Math.max(0, Math.floor(suggestedQty));
  return suggested > 0 ? suggested : 1;
}

/** 僅合併同商品、同規格的數量。 */
export function addRestockCartLine(
  lines: RestockCartLine[],
  incoming: Omit<RestockCartLine, 'quantity'> & { quantity: number },
): RestockCartLine[] {
  const addQty = Math.max(1, Math.floor(incoming.quantity));
  const index = lines.findIndex((line) => restockCartLineKey(line) === restockCartLineKey(incoming));
  if (index < 0) {
    return [...lines, { ...incoming, quantity: addQty }];
  }
  return lines.map((line, i) =>
    i === index ? { ...line, quantity: line.quantity + addQty } : line,
  );
}

export function setRestockCartQty(
  lines: RestockCartLine[],
  productId: string,
  quantity: number,
): RestockCartLine[] {
  const next = Math.max(1, Math.floor(quantity));
  return lines.map((line) => (restockCartLineKey(line) === productId ? { ...line, quantity: next } : line));
}

export function removeRestockCartLine(
  lines: RestockCartLine[],
  productId: string,
): RestockCartLine[] {
  return lines.filter((line) => restockCartLineKey(line) !== productId);
}
