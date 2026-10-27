export const COUNT_ROLES = ['admin', 'warehouse', 'finance'];
const units = new Set(['g', '隻', '片', '顆', '條', '包', '個', '件', '支', '罐', '瓶', '袋', '組']);
export function inventoryUnit(value: string | null | undefined) {
    const unit = ['克', '公克'].includes(value ?? '') ? 'g' : value;
    return unit && units.has(unit) ? unit : null;
}
export type InventoryRow = {
    id: string;
    name: string;
    sku: string;
    hqSku: string;
    productCode: string;
    vendorId: string | null;
    vendorName: string;
    category: string;
    quantity: number | null;
    unit: string | null;
    version: string | null;
    otherWarehouses: {
        name: string;
        quantity: number;
        unit: string | null;
    }[];
    canCount: boolean;
    countBlockedReason?: string;
    canConfirmUnit?: boolean;
};
export function inventoryGroup(row: Pick<InventoryRow, 'unit' | 'vendorId'>) {
    if (row.unit === 'g')
        return 'bulk';
    return row.vendorId ? 'vendor' : 'other';
}
export function parseCountQuantity(value: unknown) {
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim()))
        throw new Error('請輸入 0 以上的整數數量');
    const quantity = Number(value);
    if (!Number.isSafeInteger(quantity) || quantity > 2147483647)
        throw new Error('數量超過可儲存範圍');
    return quantity;
}
