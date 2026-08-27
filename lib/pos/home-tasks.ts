/**
 * 登入首頁待辦卡片。沒有資料的卡片不出現。
 */

export type HomeTaskKind = 'pending_refill' | 'low_stock' | 'restock_progress';

export type HomeTaskCard = {
  kind: HomeTaskKind;
  title: string;
  subtitle: string;
  href: string;
  badge: string;
  badgeUnit: string;
};

export type HomeTasksInput = {
  pendingRefillCount: number;
  /** null = 庫存不可靠，不顯示庫存不足卡 */
  lowStock: { productName: string; quantity: number }[] | null;
  openRestockCount: number;
  firstOpenRestockId: string | null;
};

export function isInventoryReliable(stockRowCount: number): boolean {
  return stockRowCount > 0;
}

export function buildHomeTaskCards(input: HomeTasksInput): HomeTaskCard[] {
  const cards: HomeTaskCard[] = [];

  if (input.pendingRefillCount > 0) {
    cards.push({
      kind: 'pending_refill',
      title: '待換罐',
      subtitle: `${input.pendingRefillCount} 筆客人尚未領取`,
      href: '/pos/refill',
      badge: String(input.pendingRefillCount),
      badgeUnit: '筆',
    });
  }

  if (input.lowStock && input.lowStock.length > 0) {
    const first = input.lowStock[0]!;
    const soldOut = first.quantity <= 0;
    const more = input.lowStock.length - 1;
    const firstLine = soldOut
      ? `${first.productName} 已售完`
      : `${first.productName} 快沒了`;
    const subtitle =
      more > 0 ? `${firstLine}\n另外 ${more} 項快沒了` : firstLine;
    cards.push({
      kind: 'low_stock',
      title: '庫存不足',
      subtitle,
      href: '/pos/stock?filter=low',
      badge: String(input.lowStock.length),
      badgeUnit: '項',
    });
  }

  if (input.openRestockCount > 0) {
    const href = input.firstOpenRestockId
      ? `/pos/restock/${input.firstOpenRestockId}`
      : '/pos/restock';
    cards.push({
      kind: 'restock_progress',
      title: '補貨中',
      subtitle: `${input.openRestockCount} 筆等待出貨`,
      href,
      badge: String(input.openRestockCount),
      badgeUnit: '筆',
    });
  }

  return cards;
}
