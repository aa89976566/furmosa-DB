// 系統內各 enum 的中文顯示對照

export const orderStatusLabel: Record<string, string> = {
  draft: '草稿',
  pending_review: '待審核',
  awaiting_shipping_payment: '等運費核對',
  confirmed: '已確認',
  packed: '待出貨',
  shipped: '已出貨',
  delivered: '已送達',
  completed: '已完成',
  cancelled: '已取消',
};

export const orderSourceLabel: Record<string, string> = {
  website: '官網',
  line: 'LINE',
  consignment: '寄賣',
  subscription: '訂閱制',
  manual: '手動',
  jar_exchange: '換罐返航',
};

export const paymentStatusLabel: Record<string, string> = {
  unpaid: '未付款',
  declared: '已申報待核對',
  awaiting_verification: '已申報待核對',
  waived: '免運',
  partial: '部分付款',
  paid: '已付款',
  failed: '付款失敗',
  cod: '貨到付款',
  refunded: '已退款',
};

export const shippingFeeTypeLabel: Record<string, string> = {
  free: '包郵',
  prepaid: '已付費',
  unpaid: '不包郵',
  cod: '運費貨到付',
};

export const fulfillmentStatusLabel: Record<string, string> = {
  pending: '待出貨',
  packed: '待出貨',
  shipped: '已出貨',
  delivered: '已送達',
  returned: '已退貨',
};

export const inventoryTxnTypeLabel: Record<string, string> = {
  purchase_in: '採購入庫',
  sales_out: '銷售出庫',
  transfer: '調撥',
  adjustment: '人工調整',
  stocktake: '盤點',
  return_in: '退貨入庫',
  return_out: '退回廠商',
};

export const merchantStockTxnTypeLabel: Record<string, string> = {
  restock: '進貨',
  sale: '銷售',
  adjust: '盤點',
  return: '退回',
};

export const settlementStatusLabel: Record<string, string> = {
  draft: '草稿',
  reviewing: '審核中',
  approved: '已核准',
  paid: '已撥款',
};

export const taskStatusLabel: Record<string, string> = {
  todo: '待辦',
  in_progress: '進行中',
  done: '已完成',
  blocked: '受阻',
};

export const taskTypeLabel: Record<string, string> = {
  inventory_issue: '庫存問題',
  settlement_followup: '結算追蹤',
  customer_service: '客戶服務',
  vendor_followup: '廠商追蹤',
  marketing: '行銷',
  shipment: '出貨',
  general: '一般',
};

export const taskPriorityLabel: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '緊急',
};

export const productCategoryLabel: Record<string, string> = {
  staple_food: '主食',
  treats: '零食',
  health: '保健',
  freeze_dried: '凍乾',
  toys: '玩具',
  accessories: '配件',
  other: '其他',
};

export {
  merchantTypeLabel,
  merchantTypeDisplay,
  MERCHANT_TYPES,
} from '@/lib/merchant-types';

export {
  merchantIndustryLabel,
  merchantIndustryDisplay,
  MERCHANT_INDUSTRIES,
} from '@/lib/merchant-industry';

export const customerTypeLabel: Record<string, string> = {
  individual: '個人',
  business: '企業',
};

export const memberStatusBadge: Record<string, string> = {
  active: '啟用',
  inactive: '停用',
};

// =====================================================
// Subscription
// =====================================================

export const subscriptionStatusLabel: Record<string, string> = {
  active: '進行中',
  paused: '暫停',
  cancelled: '已取消',
  expired: '已到期',
};

export const subscriptionBillingCycleLabel: Record<string, string> = {
  monthly: '月繳',
  halfyear: '半年付清',
};

/** 訂閱付款方式（營運備註，非刷卡串接） */
export const subscriptionPaymentTypeLabel: Record<string, string> = {
  full: '已付全額',
  monthly: '月付',
  other: '其他',
};

export const subscriptionShipmentStatusLabel: Record<string, string> = {
  pending: '待出貨',
  packed: '待出貨',
  shipped: '已出貨',
  delivered: '已送達',
  skipped: '本次跳過',
};
