/**
 * POS「今天」Dashboard 資料組裝（MERCHANT-POS-FLOW F-03）。
 * 固定順序：下一位／待確認 → 待換罐 → 缺貨 → 補貨進度。
 * 只產出有內容的列；不做 urgency score。
 */

export type TodayGuestRow = {
  kind: 'pending_confirm' | 'next_guest';
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
};

export type TodayLowStockRow = {
  kind: 'low_stock';
  title: string;
  subtitle: string;
  href: string;
  badge: string;
};

export type TodayRestockRow = {
  kind: 'restock_progress';
  title: string;
  subtitle: string;
  href: string;
  badge: string;
};

export type TodayRefillRow = {
  kind: 'pending_refill';
  title: string;
  subtitle: string;
  href: string;
  badge: string;
};

export type TodayTaskRow =
  | TodayGuestRow
  | TodayRefillRow
  | TodayLowStockRow
  | TodayRestockRow;

export type TodayDashboardInput = {
  pendingConfirmCount: number;
  nextGuest: {
    id: string;
    petName: string | null;
    customerName: string;
    startsAt: Date | string | number;
    status: string;
  } | null;
  /** 已付款待收空罐／待交付 */
  pendingRefillCount: number;
  /** null = 庫存不可靠（無門市庫存列），不顯示缺貨列 */
  lowStock: { productName: string; quantity: number }[] | null;
  openRestockCount: number;
  /** 第一筆進行中申請，供補貨列深鏈 */
  firstOpenRestockId: string | null;
};

export function formatGuestSubtitle(input: {
  petName: string | null;
  customerName: string;
  startsAt: Date | string | number;
  status: string;
}): string {
  const who = input.petName?.trim() || input.customerName.trim() || '客人';
  const at =
    input.startsAt instanceof Date ? input.startsAt : new Date(input.startsAt);
  const hh = Number.isNaN(at.getTime())
    ? '--'
    : String(at.getHours()).padStart(2, '0');
  const mm = Number.isNaN(at.getTime())
    ? '--'
    : String(at.getMinutes()).padStart(2, '0');
  const statusHint =
    input.status === 'requested'
      ? '待確認'
      : input.status === 'reschedule_proposed'
        ? '改期待回'
        : null;
  return statusHint ? `${who} · ${hh}:${mm} · ${statusHint}` : `${who} · ${hh}:${mm}`;
}

/**
 * 依 F-03 固定順序組列；數量為 0 或不可靠則省略。
 * 順序：客人 → 待換罐 → 缺貨 → 補貨進度。
 */
export function buildTodayTaskRows(input: TodayDashboardInput): TodayTaskRow[] {
  const rows: TodayTaskRow[] = [];

  // 1. 客人：待確認優先於下一位（同屬客人任務，不另開 urgency score）
  if (input.pendingConfirmCount > 0) {
    rows.push({
      kind: 'pending_confirm',
      title: '待確認預約',
      subtitle: '客人在等你回覆',
      href: '/pos/appointments',
      badge: String(input.pendingConfirmCount),
    });
  }

  if (input.nextGuest) {
    rows.push({
      kind: 'next_guest',
      title: '下一位客人',
      subtitle: formatGuestSubtitle(input.nextGuest),
      href: `/pos/appointments/${input.nextGuest.id}`,
    });
  }

  // 2. 待換罐
  if (input.pendingRefillCount > 0) {
    rows.push({
      kind: 'pending_refill',
      title: '待換罐',
      subtitle: '已付款、等待收空罐或交付',
      href: '/pos/refill',
      badge: String(input.pendingRefillCount),
    });
  }

  // 3. 缺貨提醒 — 僅門市庫存可靠時
  if (input.lowStock && input.lowStock.length > 0) {
    const first = input.lowStock[0]!;
    const more = input.lowStock.length - 1;
    const subtitle =
      more > 0
        ? `${first.productName}剩 ${first.quantity} · 另 ${more} 項`
        : `${first.productName}剩 ${first.quantity}`;
    rows.push({
      kind: 'low_stock',
      title: '缺貨提醒',
      subtitle,
      href: '/pos/restock',
      badge: String(input.lowStock.length),
    });
  }

  // 4. 補貨進度
  if (input.openRestockCount > 0) {
    const href = input.firstOpenRestockId
      ? `/pos/restock/${input.firstOpenRestockId}`
      : '/pos/restock/progress';
    rows.push({
      kind: 'restock_progress',
      title: '補貨進度',
      subtitle: `${input.openRestockCount} 張處理中`,
      href,
      badge: String(input.openRestockCount),
    });
  }

  return rows;
}

export function isInventoryReliable(stockRowCount: number): boolean {
  return stockRowCount > 0;
}
