export const RESTOCK_REQUEST_TYPES = ['SELF_SELECT', 'AUTO_REPLENISH'] as const;
export type RestockRequestType = (typeof RESTOCK_REQUEST_TYPES)[number];

export const RESTOCK_REQUEST_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'converted_to_shipment',
  'cancelled',
] as const;
export type RestockRequestStatus = (typeof RESTOCK_REQUEST_STATUSES)[number];

/** Statuses that HQ may still convert to shipment */
export const RESTOCK_APPROVABLE_STATUSES: RestockRequestStatus[] = [
  'submitted',
  'under_review',
  'approved',
];

/** HQ may save approved quantities / start review. */
export const RESTOCK_HQ_EDITABLE_STATUSES: RestockRequestStatus[] = [
  'submitted',
  'under_review',
];

/** HQ may reject. approved 不可再拒絕（避免舊畫面覆蓋已核准）。 */
export const RESTOCK_REJECTABLE_STATUSES: RestockRequestStatus[] = [
  'submitted',
  'under_review',
];

/** 已結束，不能再審核。 */
export const RESTOCK_FINAL_STATUSES: RestockRequestStatus[] = [
  'rejected',
  'cancelled',
  'converted_to_shipment',
];

export type ApprovedSnapshotLine = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
};

/** Merchant-facing status labels (no enum jargon). */
export function restockStatusLabelForMerchant(status: string): string {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'submitted':
    case 'under_review':
      return '公司確認中';
    case 'approved':
      return '已確認';
    case 'converted_to_shipment':
      return '備貨中';
    case 'rejected':
      return '需要調整';
    case 'cancelled':
      return '已取消';
    default:
      return '處理中';
  }
}

export function restockRequestTypeLabel(type: string): string {
  switch (type) {
    case 'SELF_SELECT':
      return '我要自己選';
    case 'AUTO_REPLENISH':
      return '請幫我配';
    default:
      return type;
  }
}

export function restockStatusLabelForHq(status: string): string {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'submitted':
      return '待審核';
    case 'under_review':
      return '審核中';
    case 'approved':
      return '已核准（待轉單）';
    case 'converted_to_shipment':
      return '已建立出貨單';
    case 'rejected':
      return '已拒絕';
    case 'cancelled':
      return '已取消';
    default:
      return status;
  }
}
