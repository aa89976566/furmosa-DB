export const COUNT_ROLES = ['admin', 'warehouse', 'finance'];
const units = new Set(['g', '隻', '片', '顆', '條', '包', '個', '件', '支', '罐', '瓶', '袋', '組']);
export function inventoryUnit(value: string | null | undefined) {
    const unit = ['克', '公克'].includes(value ?? '') ? 'g' : value;
    return unit && units.has(unit) ? unit : null;
}
export type InventoryRow = {
    id: string;
    imageUrl?: string | null;
    status?: string;
    productCategory?: string;
    name: string;
    sku: string;
    hqSku: string;
    productCode: string;
    vendorId: string | null;
    vendorName: string;
    category: string;
    reorderPoint?: number;
    lastCountedAt?: string | null;
    priceTiers?: { weightGrams: number | null; unit: string; unitQty: number }[];
    merchantStocks?: { merchantId: string; merchantName: string; quantity: number; tierLabel: string }[];
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

export type InventoryStockState = 'negative' | 'needs_setup' | 'zero' | 'low' | 'in_stock' | 'inactive' | 'special';
export function inventoryStockState(row: InventoryRow): InventoryStockState {
    if (row.status === 'inactive') return 'inactive';
    if (row.productCategory && row.productCategory !== 'STANDARD') return 'special';
    if (row.quantity !== null && row.quantity < 0) return 'negative';
    if (!row.canCount || row.quantity === null || !row.unit) return 'needs_setup';
    if (row.quantity === 0) return 'zero';
    if (row.reorderPoint !== undefined && row.quantity <= row.reorderPoint) return 'low';
    return 'in_stock';
}
export const inventoryStateLabels: Record<InventoryStockState, string> = {
    negative: '負庫存待核對', needs_setup: '待設定', zero: '缺貨', low: '偏低',
    in_stock: '充足', inactive: '已停用', special: '非一般庫存',
};
const stockPriority: Record<InventoryStockState, number> = { negative: 0, needs_setup: 1, zero: 2, low: 3, in_stock: 4, special: 5, inactive: 6 };
export function compareInventoryUrgency(a: InventoryRow, b: InventoryRow) {
    // Different base units are never compared or added together.
    return stockPriority[inventoryStockState(a)] - stockPriority[inventoryStockState(b)]
        || a.name.localeCompare(b.name, 'zh-TW') || a.id.localeCompare(b.id);
}
export function inventoryPackEstimates(row: InventoryRow) {
    if (row.unit !== 'g' || !row.canCount || row.quantity === null || row.quantity <= 0) return [];
    const weights = [...new Set((row.priceTiers ?? [])
        .filter(tier => inventoryUnit(tier.unit) === 'g' && tier.weightGrams != null && Number.isSafeInteger(tier.weightGrams) && tier.weightGrams > 0 && tier.unitQty === 1)
        .map(tier => tier.weightGrams!))].sort((a, b) => a - b);
    return weights.map(weight => ({ weight, packs: Math.floor(row.quantity! / weight) }));
}
