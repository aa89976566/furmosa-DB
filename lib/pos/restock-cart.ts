export type RestockCartLine = {
  productId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
};

export function restockCartTotalPieces(lines: RestockCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function defaultRestockAddQty(suggestedQty: number): number {
  const suggested = Math.max(0, Math.floor(suggestedQty));
  return suggested > 0 ? suggested : 1;
}

/** 同商品合併數量，不新增第二列。 */
export function addRestockCartLine(
  lines: RestockCartLine[],
  incoming: Omit<RestockCartLine, 'quantity'> & { quantity: number },
): RestockCartLine[] {
  const addQty = Math.max(1, Math.floor(incoming.quantity));
  const index = lines.findIndex((line) => line.productId === incoming.productId);
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
  return lines.map((line) => (line.productId === productId ? { ...line, quantity: next } : line));
}

export function removeRestockCartLine(
  lines: RestockCartLine[],
  productId: string,
): RestockCartLine[] {
  return lines.filter((line) => line.productId !== productId);
}
