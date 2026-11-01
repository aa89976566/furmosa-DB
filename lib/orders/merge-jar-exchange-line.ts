export type JarExchangeLine = {
  productId: string;
  tierId: string;
  quantity: number;
  isGift: boolean;
};

/**
 * 換罐計畫同一商品與同一規格只保留一列，新增數量累加到既有列。
 * 贈品維持獨立列，避免混入換罐補貨數量。
 */
export function mergeJarExchangeLine<T extends JarExchangeLine>(
  items: T[],
  incoming: T,
): { items: T[]; merged: boolean } {
  if (!incoming.productId || incoming.isGift) {
    return { items: [...items, incoming], merged: false };
  }

  const existingIndex = items.findIndex(
    (item) =>
      !item.isGift &&
      item.productId === incoming.productId &&
      item.tierId === incoming.tierId,
  );

  if (existingIndex < 0) {
    return { items: [...items, incoming], merged: false };
  }

  return {
    items: items.map((item, index) =>
      index === existingIndex
        ? { ...item, quantity: item.quantity + incoming.quantity }
        : item,
    ),
    merged: true,
  };
}
