export type CounterCatalogItem = {
  key: string;
  productId: string;
  tierId: string;
  name: string;
  specLabel: string | null;
  category: string;
  categoryLabel: string;
  unitPrice: number;
  stock: number;
  imageUrl: string | null;
  unit: string;
};

export function resolveCounterSellStock(args: {
  listedTierId: string;
  isDefaultTier: boolean;
  exactStock: number | undefined;
  legacyStock: number | undefined;
  legacyTierId: string;
}): { stock: number; sellTierId: string } {
  if (args.exactStock != null) {
    return { stock: args.exactStock, sellTierId: args.listedTierId };
  }
  if (args.isDefaultTier && args.legacyStock != null) {
    return { stock: args.legacyStock, sellTierId: args.legacyTierId };
  }
  return { stock: 0, sellTierId: args.listedTierId };
}

export function filterCounterItems(
  items: CounterCatalogItem[],
  query: string,
  category: string | 'all',
) {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      (item.specLabel ?? '').toLowerCase().includes(q)
    );
  });
}
