export type RestockCartLine = {
  productId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  variantKey?: string | null;
};

export function restockCartTotalPieces(lines: RestockCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function defaultRestockAddQty(_suggestedQty: number): number {
  return 0;
}

export function restockLineKey(line: { productId: string; variantKey?: string | null }): string {
  return JSON.stringify([line.productId, line.variantKey || ""]);
}

/** 只合併相同商品與規格。 */
export function addRestockCartLine(
  lines: RestockCartLine[],
  incoming: Omit<RestockCartLine, 'quantity'> & { quantity: number },
): RestockCartLine[] {
  if (!Number.isFinite(incoming.quantity) || incoming.quantity < 1) return lines;
  const addQty = Math.floor(incoming.quantity);
  const index = lines.findIndex((line) => restockLineKey(line) === restockLineKey(incoming));
  if (index < 0) {
    return [...lines, { ...incoming, quantity: addQty }];
  }
  return lines.map((line, i) =>
    i === index ? { ...line, quantity: line.quantity + addQty, variantKey: incoming.variantKey ?? line.variantKey } : line,
  );
}

export function setRestockCartQty(
  lines: RestockCartLine[],
  productId: string,
  quantity: number,
  variantKey?: string | null,
): RestockCartLine[] {
  const next = Math.max(1, Math.floor(quantity));
  return lines.map((line) => (restockLineKey(line) === restockLineKey({ productId, variantKey }) ? { ...line, quantity: next } : line));
}

export function removeRestockCartLine(
  lines: RestockCartLine[],
  productId: string,
  variantKey?: string | null,
): RestockCartLine[] {
  return lines.filter((line) => restockLineKey(line) !== restockLineKey({ productId, variantKey }));
}
