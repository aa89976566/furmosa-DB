export const PREVIEW_BANNER_PRIMARY = '操作預覽｜資料不會儲存';
export const PREVIEW_BANNER_SECONDARY = '以下為示意商品與訂單，不是正式店家資料';

export const PREVIEW_TITLE = 'POS 預覽';
export const FIXTURE_ONLY_BADGE = 'fixture-only';
export const STORE_NAME = '測試門市';

export const TABS = {
  checkout: '收銀',
  sales: '銷售',
  restock: '補貨',
  more: '更多',
} as const;

export const SEARCH_LABEL = '搜尋商品';
export const SEARCH_PLACEHOLDER = '商品名、貨號或口味規格';
export const SEARCH_EMPTY = '沒有符合的示意商品。請改搜商品名、貨號或規格。';

export const LIST_PRICE_LABEL = '建議售價';
export const AVAILABLE_QTY_LABEL = '可售庫存';
export const LOW_STOCK_BADGE = '低庫存';
export const SOLD_OUT_BADGE = '售罄';
export const SELECT_SPEC_HINT = '請先選規格，再加入購物車。';
export const ADD_TO_CART = '加入購物車';
export const VIEW_RESTOCK = '查看補貨';
export const STOCK_CAP_ERROR = '不能超過示意庫存。';
export const CART_EMPTY = '購物車是空的。選規格後即可加入。';

export const ACTUAL_PRICE_LABEL = '實際成交單價';
export const ACTUAL_PRICE_HINT = '只接受正整數台幣。';
export const LIST_SUBTOTAL_LABEL = '原價小計';
export const ACTUAL_SUBTOTAL_LABEL = '實際成交小計';
export const ALLOWANCE_LABEL = '折讓差額';
export const SURCHARGE_LABEL = '加價差額';
export const ITEM_COUNT_LABEL = '件數';

export const COMPLETE_SALE = '完成示意銷售';
export const COMPLETE_SALE_CONFIRM_TITLE = '建立示意收據？';
export const COMPLETE_SALE_CONFIRM_BODY =
  '只會留在這個畫面的記憶體。重新整理後會消失，並未建立真實訂單。';
export const COMPLETE_SALE_CONFIRM = '建立示意收據';
export const COMPLETE_SALE_CANCEL = '先不要';
export const SALE_SUCCESS =
  '已建立示意收據。重新整理後會消失，並未建立真實訂單。';

export const RESTOCK_INTRO =
  '只列出低庫存與售罄的示意貨號。送出後不會增加庫存。正式流程是店家送出 → 總部核准 → 出貨 → 到貨後才入庫。';
export const RESTOCK_QTY_LABEL = '補貨數量';
export const RESTOCK_SUGGESTED_LABEL = '建議量';
export const ADD_RESTOCK_LINE = '加入補貨草稿';
export const ADD_ALL_RESTOCK = '一鍵加入補貨草稿';
export const SUBMIT_RESTOCK = '送出補貨（示意）';
export const RESTOCK_SUBMITTED = '已送出（示意）';
export const RESTOCK_SUCCESS =
  '補貨草稿已送出（示意）。庫存不會增加。正式流程是店家送出 → 總部核准 → 出貨 → 到貨後才入庫。';
export const RESTOCK_EMPTY_DRAFT = '草稿還是空的。請先加入低庫存或售罄貨號。';
export const RESTOCK_ALREADY_SENT = '這次示意補貨已經送出，請勿重複送出。';

export const SALES_INTRO = '以下是示意訂單，不是正式店家資料。';
export const REQUEST_REFUND = '申請退款（示意）';
export const REQUEST_REFUND_TITLE = '送出退款申請（示意）？';
export const REQUEST_REFUND_BODY =
  '只會把這筆標成已申請。這個畫面沒有核准或完成退款的按鈕，也不會動到庫存或佣金。';
export const REQUEST_REFUND_CONFIRM = '送出申請（示意）';
export const REQUEST_REFUND_CANCEL = '先不要';
export const REFUND_SUCCESS =
  '已送出退款申請（示意）。總部尚未審核；此頁不會核准或完成退款。';
export const REFUND_ALREADY = '這筆已經申請過，不能重複送出。';
export const NEXT_PERIOD_NOTE = '將列入次期調整';

export const GROOMING_ENTRY_TITLE = '美容服務券';
export const GROOMING_ENTRY_BODY =
  '這是美容服務券，不是商品折價券。正式門市編號尚未接入，禁止用中文店名判斷 200 或 250。核銷仍是示意操作。';
export const GROOMING_ENTRY_HINT =
  '沿用既有美容服務券預覽。服務總額必須嚴格大於券額；固定補貼券面額、不再計普通佣金、不需收據。';
export const GROOMING_ENTRY_CTA = '開啟美容服務券預覽';
export const GROOMING_PREVIEW_HREF = '/preview/grooming-voucher';

export const SETTLEMENT_TITLE = '結算摘要';
export const SETTLEMENT_INTRO = '伺服器快照；本頁不重算。';
export const SETTLEMENT_LOCKED = '已鎖定，不可重開；差異走次期調整';
export const SETTLEMENT_ROW_SOURCE = '來源';
export const SETTLEMENT_ROW_DIRECTION = '方向';
export const SETTLEMENT_ROW_ROUTE = '期間';
export const SETTLEMENT_ROW_PAYER = '付款方';
export const SETTLEMENT_ROW_PAYEE = '收款方';
export const SETTLEMENT_ROW_AMOUNT = '金額';
export const SETTLEMENT_ROW_NOTE = '說明';
export const NET_LABEL = '淨應收／應付';
export const THIS_PERIOD_LABEL = '本期';
export const NEXT_PERIOD_LABEL = '次期調整';
export const AUDIT_ONLY_LABEL = '對帳用，不列入應付';

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
export const DIALOG_NAV_LABEL = 'POS 預覽分頁';
