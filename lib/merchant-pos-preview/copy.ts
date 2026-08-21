export const PREVIEW_BANNER_PRIMARY = '操作預覽｜資料不會儲存';
export const PREVIEW_BANNER_SECONDARY = '以下為示意商品與訂單，不是正式店家資料';

export const PREVIEW_TITLE = '門市收銀預覽';
export const FIXTURE_ONLY_BADGE = '示意資料';
export const STORE_NAME = '測試門市';

export const TABS = {
  checkout: '收銀',
  sales: '銷售',
  restock: '補貨',
  points: '點數核銷',
  settlement: '結算',
} as const;

export const CHECKOUT_INTRO = '先選規格，再加入購物車。';
export const SEARCH_LABEL = '搜尋商品';
export const SEARCH_PLACEHOLDER = '商品名、貨號或口味規格';
export const SEARCH_EMPTY = '沒有符合的示意商品。請改搜商品名、貨號或規格。';

export const LIST_PRICE_LABEL = '建議售價';
export const AVAILABLE_QTY_LABEL = '可銷售庫存';
export const LOW_STOCK_BADGE = '低庫存';
export const SOLD_OUT_BADGE = '售罄';
export const SELECT_SPEC_HINT = '請先選規格，再加入購物車。';
export const ADD_TO_CART = '加入購物車';
export const VIEW_RESTOCK = '查看補貨';
export const AT_STOCK_CAP = '已達庫存上限';
export const STOCK_ALL_IN_CART = '庫存已全放入購物車';
export const FIX_CART_QTY = '請先到購物車修正數量';
export const CART_HAS_QTY_PREFIX = '購物車內';
export const CART_EMPTY = '購物車是空的。選規格後即可加入。';

export function cartHasQtyLabel(qty: number): string {
  return `${CART_HAS_QTY_PREFIX} ${qty} 件`;
}

export const ACTUAL_PRICE_LABEL = '實際成交單價';
export const ACTUAL_PRICE_HINT = '只接受正整數台幣。';
export const LIST_SUBTOTAL_LABEL = '原價小計';
export const ACTUAL_SUBTOTAL_LABEL = '實際成交小計';
export const ALLOWANCE_LABEL = '折讓差額';
export const SURCHARGE_LABEL = '加價差額';
export const ITEM_COUNT_LABEL = '件數';
export const CART_QTY_LABEL = '數量';

export const COMPLETE_SALE = '完成銷售（預覽）';
export const COMPLETE_SALE_CONFIRM_TITLE = '確認完成這筆銷售？';
export const COMPLETE_SALE_CONFIRM_BODY =
  '此為操作預覽，不建立訂單、不扣除庫存。重新整理後會重置。';
export const COMPLETE_SALE_CONFIRM = '完成銷售';
export const COMPLETE_SALE_CANCEL = '返回購物車';
export const SALE_SUCCESS =
  '已完成示意銷售。這是操作預覽，完成後不會扣減示意庫存；重新整理會重置。不會建立真實訂單。';
export const SALE_SUCCESS_SUMMARY = '已完成示意銷售。';
export const RECEIPT_LABEL = '示意收據';
export const CART_ESCAPE_HINT = '按 Esc 也可以返回購物車。';

export const RESTOCK_INTRO =
  '只列出低庫存與售罄的示意貨號。送出後不會增加庫存。正式流程是門市送出 → 總部核准 → 出貨 → 到貨後才入庫。';
export const RESTOCK_QTY_LABEL = '補貨數量';
export const RESTOCK_SUGGESTED_LABEL = '建議量';
export const ADD_RESTOCK_LINE = '加入補貨單草稿';
export const ADD_ALL_RESTOCK = '全部加入補貨單';
export const SUBMIT_RESTOCK = '送出補貨申請（預覽）';
export const RESTOCK_SUBMITTED = '已送出補貨申請（預覽）';
export const RESTOCK_SUCCESS =
  '補貨單草稿已送出（預覽）。庫存不會增加。正式流程是門市送出 → 總部核准 → 出貨 → 到貨後才入庫。';
export const RESTOCK_EMPTY_DRAFT = '補貨單草稿還是空的。請先加入低庫存或售罄貨號。';
export const RESTOCK_ALREADY_SENT = '這次補貨申請已經送出，請勿重複送出。';
export const RESTOCK_DRAFT_TITLE = '補貨單草稿';

export const SALES_TITLE = '銷售與退款';
export const SALES_INTRO = '以下是示意訂單，不是正式店家資料。';
export const REQUEST_REFUND = '提出退款申請';
export const REQUEST_REFUND_TITLE = '提出退款申請？';
export const REQUEST_REFUND_BODY =
  '送出後僅建立退款申請；須由總部審核，不會立即退款或異動庫存。';
export const REQUEST_REFUND_CONFIRM = '提出申請';
export const REQUEST_REFUND_CANCEL = '返回';
export const REFUND_SUCCESS = '已提出退款申請。總部尚未審核；此頁不會審核或完成退款。';
export const REFUND_ALREADY = '這筆已經提出過申請，不能重複送出。';
export const NEXT_PERIOD_NOTE = '將列入下期調整';

export const GROOMING_ENTRY_TITLE = '美容服務券';
export const GROOMING_ENTRY_BODY =
  '這是美容服務券，不是商品折價券。正式門市編號尚未接入，不能用中文店名判斷 200 或 250。核銷仍是預覽操作。';
export const GROOMING_ENTRY_HINT =
  '沿用既有美容服務券預覽。服務總額必須嚴格大於券額；固定補貼券面額、不再計普通佣金、不需收據。';
export const GROOMING_ENTRY_CTA = '開啟美容服務券預覽';
export const GROOMING_PREVIEW_HREF = '/preview/grooming-voucher';

export const POINTS_REDEMPTION_INTRO = '使用點數兌換美容服務券。';
export const SETTLEMENT_TITLE = '本期結算';
export const SETTLEMENT_INTRO = '金額以總部結算結果為準。';
export const SETTLEMENT_LOCKED = '已鎖定，不可重新開啟';
export const SETTLEMENT_ROW_SOURCE = '來源';
export const SETTLEMENT_ROW_DIRECTION = '方向';
export const SETTLEMENT_ROW_ROUTE = '期間';
export const SETTLEMENT_ROW_PAYER = '付款方';
export const SETTLEMENT_ROW_PAYEE = '收款方';
export const SETTLEMENT_ROW_AMOUNT = '金額';
export const SETTLEMENT_ROW_NOTE = '說明';
export const NET_LABEL = '本期淨額';
export const THIS_PERIOD_LABEL = '本期結算';
export const NEXT_PERIOD_LABEL = '下期調整';
export const AUDIT_ONLY_LABEL = '對帳用，不列入應付';
export const NET_HQ_OWES_LABEL = '總部應付門市';
export const NET_MERCHANT_OWES_LABEL = '門市應匯總部';

export const REFUND_CONDITION_LABEL = '實物狀況';
export const REFUND_DISPOSITION_LABEL = '庫存處置';
export const REFUND_LOSS_REASON_LABEL = '損耗原因';
export const RESTOCK_SELLABLE_LABEL = '已回可售庫存';
export const LOSS_UNSELLABLE_LABEL = '不回可售庫存';

export const PRICE_ERROR_EMPTY = '請輸入正整數台幣。';
export const PRICE_ERROR_INVALID = '成交單價只接受正整數台幣。';
export const QTY_ERROR_INVALID = '數量只接受正整數。';

export const CLOSE_DIALOG = '關閉';
export const CART_TITLE = '購物車';
export const OPEN_CART = '看購物車';
export const REMOVE_LINE = '移除';
export const INCREASE_QTY = '增加數量';
export const DECREASE_QTY = '減少數量';
export const DIALOG_NAV_LABEL = '門市收銀分頁';
export const DEAL_LABEL = '成交';

export function qtyRangeHint(maxQty: number): string {
  return `請輸入 1～${maxQty} 的整數`;
}

export function qtyOverStockError(maxQty: number): string {
  return `庫存不足，目前最多 ${maxQty} 件`;
}
