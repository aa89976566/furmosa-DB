import { bulkUnit } from '../inventory/bulk';

/** A main-warehouse balance must not be summed with other warehouses or units. */
export function productMainStock(balance: { quantity: number; unit: string | null } | undefined, productUnit: string) {
  const unit = bulkUnit(balance?.unit);
  const verified = Boolean(balance && unit && unit === bulkUnit(productUnit));
  return { verified, negative: Boolean(balance && balance.quantity < 0),
    label: balance ? `${balance.quantity.toLocaleString('zh-TW')} ${unit ?? '（單位待確認）'}` : '尚無紀錄' };
}

/** Per-gram costs can be below one cent; retain the stored six-decimal precision. */
export function formatUnitCost(value: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Number(value));
}
