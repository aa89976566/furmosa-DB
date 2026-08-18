export type TabId = 'checkout' | 'sales' | 'restock' | 'more';

export type StockLevel = 'normal' | 'low' | 'sold_out';

export type CollectionChannel = 'merchant_collected' | 'furmosa_collected_line_ecpay';

export type RefundStatus = 'requested' | 'approved' | 'rejected' | 'completed';

export type SettlementStatus = 'draft' | 'reviewing' | 'approved' | 'paid';

export type NetDirection = 'hq_owes_merchant' | 'merchant_owes_hq' | 'balanced';

export type RefundInventoryDisposition = 'pending' | 'restock_sellable' | 'loss_unsellable' | 'none';

export type ProductVariant = {
  skuId: string;
  sku: string;
  specLabel: string;
  listPriceTwd: number;
  availableQty: number;
  lowStockAt: number;
  suggestedRestockQty: number;
};

export type Product = {
  productId: string;
  name: string;
  variants: ProductVariant[];
};

export type CartLine = {
  skuId: string;
  qty: number;
  actualUnitPriceInput: string;
};

export type DemoReceiptLine = {
  skuId: string;
  name: string;
  specLabel: string;
  qty: number;
  listPriceTwd: number;
  actualUnitPriceTwd: number;
  listLineTwd: number;
  actualLineTwd: number;
};

export type DemoReceipt = {
  receiptId: string;
  notice: string;
  itemCount: number;
  listSubtotalTwd: number;
  actualSubtotalTwd: number;
  allowanceTwd: number;
  lines: DemoReceiptLine[];
};

export type RestockDraftLine = {
  skuId: string;
  qty: number;
};

export type RestockSubmission = {
  submissionId: string;
  statusLabel: string;
  notice: string;
};

export type SaleItemSnapshot = {
  name: string;
  specLabel: string;
  qty: number;
  actualLineTwd: number;
};

export type RefundOutcomeSnapshot = {
  status: RefundStatus;
  statusLabel: string;
  note: string;
  nextPeriodNote: string | null;
  inventoryNote: string;
  commissionNote: string;
  inventoryDisposition: RefundInventoryDisposition;
  conditionLabel: string | null;
  lossReason: string | null;
  sellableStockReturned: boolean;
  settledInLockedPeriod: boolean;
};

export type SaleSnapshot = {
  saleId: string;
  soldAtLabel: string;
  channel: CollectionChannel;
  channelLabel: string;
  pickupLabel: string | null;
  statusLabel: string;
  actualTotalTwd: number;
  items: SaleItemSnapshot[];
  refund: RefundOutcomeSnapshot | null;
  canMerchantRequestRefund: boolean;
};

export type LedgerKind = 'audit' | 'obligation';

export type LedgerDirection = 'hq_owes_merchant' | 'merchant_owes_hq';

export type PeriodRoute = 'this_period' | 'next_period';

export type SettlementLedgerRow = {
  rowId: string;
  label: string;
  source: string;
  kind: LedgerKind;
  direction: LedgerDirection | null;
  payer: string;
  payee: string;
  amountTwd: number;
  hqPerspectiveSignedTwd: number;
  note: string;
  periodRoute: PeriodRoute;
  periodRouteLabel: string;
};

export type SettlementSnapshot = {
  settlementId: string;
  status: SettlementStatus;
  statusLabel: string;
  periodLabel: string;
  ledger: SettlementLedgerRow[];
  netDirection: NetDirection;
  netDirectionLabel: string;
  netAmountTwd: number;
  locked: boolean;
  lockNote: string | null;
};

export type PriceParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export type CartTotals = {
  itemCount: number;
  listSubtotalTwd: number;
  actualSubtotalTwd: number;
  allowanceTwd: number;
};

export type MerchantPosSession = {
  tab: TabId;
  query: string;
  selectedSkuByProductId: Record<string, string>;
  cart: CartLine[];
  cartOpen: boolean;
  cartDialogStep: 'lines' | 'confirm';
  refundConfirmSaleId: string | null;
  demoReceipts: DemoReceipt[];
  receiptSeq: number;
  saleNotice: string | null;
  restockQtyBySkuId: Record<string, string>;
  restockDraft: RestockDraftLine[];
  restockSubmitting: boolean;
  restockSubmitted: boolean;
  restockNotice: string | null;
  localRefunds: Record<string, true>;
  refundNotice: string | null;
};

export type CatalogRow = {
  product: Product;
  selected: ProductVariant | null;
  stockLevel: StockLevel | null;
  matches: boolean;
};
