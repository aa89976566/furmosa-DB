export type CounterCartLine = {
  key: string;
  productId: string;
  tierId: string;
  name: string;
  specLabel: string | null;
  unitPrice: number;
  qty: number;
  stock: number;
  imageUrl: string | null;
};

export type CounterCartItemInput = Omit<CounterCartLine, 'qty'> & { qty?: number };

export function counterLineKey(productId: string, tierId: string) {
  return `${productId}::${tierId}`;
}

export function cartItemCount(lines: CounterCartLine[]) {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

export function cartSubtotal(lines: CounterCartLine[]) {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
}

function clampQty(qty: number, stock: number) {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const next = Math.floor(qty);
  if (stock <= 0) return 0;
  return Math.min(next, stock);
}

export function addCartLine(
  lines: CounterCartLine[],
  item: CounterCartItemInput,
  addQty = 1,
): CounterCartLine[] {
  const add = Math.floor(addQty);
  if (add <= 0) return lines;
  const existing = lines.find((line) => line.key === item.key);
  const currentQty = existing?.qty ?? 0;
  const nextQty = clampQty(currentQty + add, item.stock);
  if (nextQty <= 0) return lines.filter((line) => line.key !== item.key);
  const nextLine: CounterCartLine = {
    ...item,
    qty: nextQty,
  };
  if (!existing) return [...lines, nextLine];
  return lines.map((line) => (line.key === item.key ? nextLine : line));
}

export function setCartLineQty(
  lines: CounterCartLine[],
  key: string,
  qty: number,
): CounterCartLine[] {
  const existing = lines.find((line) => line.key === key);
  if (!existing) return lines;
  const nextQty = clampQty(qty, existing.stock);
  if (nextQty <= 0) return lines.filter((line) => line.key !== key);
  return lines.map((line) => (line.key === key ? { ...line, qty: nextQty } : line));
}

export function catalogAddDisabled(stock: number, cartQty: number) {
  return stock <= 0 || cartQty >= stock;
}
