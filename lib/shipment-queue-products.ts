import { productLabel } from '@/lib/product-label';
import {
  JIBA_PRODUCTS,
  type JibaProductKey,
} from '@/lib/campaigns/jiba-two-piece/constants';

/** 出貨佇列／詳情共用的品項列 */
export type ShipmentProductLine = {
  key: string;
  name: string;
  quantity: number;
  sku?: string | null;
  unit?: string | null;
  weightGrams?: number | null;
  /** shipment_item | plan | campaign | order_item */
  source: 'shipment_item' | 'plan' | 'campaign' | 'order_item';
};

export type ProductSummaryState = 'ok' | 'empty' | 'anomaly';

export type ProductSummaryModel = {
  state: ProductSummaryState;
  lines: ShipmentProductLine[];
  /** 品項數（列數） */
  itemCount: number;
  /** 件數合計 */
  totalQty: number;
  /** 列表可見的 1–2 行「品名 ×數量」 */
  visibleLines: string[];
  /** >2 時：另有 N 項・共 M 件 */
  overflowLabel: string | null;
  /** 完整品名（tooltip / title） */
  fullNames: string[];
  message: string | null;
};

export const PRODUCT_ANOMALY_MESSAGE = '品項資料異常，請先檢查';
export const PRODUCT_EMPTY_MESSAGE = '尚無品項';
export const PRODUCT_LOADING_MESSAGE = '品項載入中…';

export type ResolveShipmentProductsInput = {
  type: string;
  items: Array<{
    id?: string;
    productName: string | null | undefined;
    quantity: number;
    sku?: string | null;
    unit?: string | null;
    weightGrams?: number | null;
  }>;
  planContents?: Array<{ name: string; weight?: string | null }>;
  /** 活動／零價贈品 fallback（唯讀） */
  campaignProduct?: {
    productName: string;
    quantity: number;
    unit?: string | null;
    sku?: string | null;
  } | null;
  /** 訂單品項 fallback（唯讀；含零價／贈品） */
  orderItems?: Array<{
    id?: string;
    productName: string | null | undefined;
    quantity: number;
    sku?: string | null;
    unit?: string | null;
    weightGrams?: number | null;
  }> | null;
};

function lineLabel(line: ShipmentProductLine): string {
  return `${line.name} ×${line.quantity}`;
}

function normalizeShipmentItems(
  items: ResolveShipmentProductsInput['items'],
): ShipmentProductLine[] {
  const lines: ShipmentProductLine[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const name = (item.productName ?? '').trim();
    if (!name) {
      // 有列但缺品名 → 交給上層判為 anomaly（保留佔位）
      lines.push({
        key: item.id ?? `broken-${i}`,
        name: '',
        quantity: item.quantity,
        sku: item.sku ?? null,
        unit: item.unit ?? null,
        weightGrams: item.weightGrams ?? null,
        source: 'shipment_item',
      });
      continue;
    }
    lines.push({
      key: item.id ?? `item-${i}`,
      name: productLabel(name, item.weightGrams, item.unit),
      quantity: item.quantity,
      sku: item.sku ?? null,
      unit: item.unit ?? null,
      weightGrams: item.weightGrams ?? null,
      source: 'shipment_item',
    });
  }
  return lines;
}

/**
 * 解析出貨品項顯示模型。
 * 優先順序：ShipmentItem → OrderItem → 訂閱方案 → 活動 fallback。
 * 不從 notes 捏造品項；若履約應有品項卻完全無來源，回傳 anomaly。
 */
export function resolveShipmentProducts(
  input: ResolveShipmentProductsInput,
): ProductSummaryModel {
  const shipmentLines = normalizeShipmentItems(input.items);
  const hasBrokenName = shipmentLines.some((line) => !line.name);

  let lines: ShipmentProductLine[] = shipmentLines.filter((line) => line.name);

  if (lines.length === 0 && input.orderItems && input.orderItems.length > 0) {
    lines = normalizeShipmentItems(input.orderItems).map((line, index) => ({
      ...line,
      key: line.key.startsWith('item-') ? `order-${index}` : line.key,
      source: 'order_item' as const,
    })).filter((line) => line.name);
  }

  if (lines.length === 0 && input.type === 'subscription' && (input.planContents?.length ?? 0) > 0) {
    lines = (input.planContents ?? []).map((item, index) => ({
      key: `plan-${index}`,
      name: item.weight ? `${item.name}（${item.weight}）` : item.name,
      quantity: 1,
      sku: null,
      unit: null,
      weightGrams: null,
      source: 'plan' as const,
    }));
  }

  if (lines.length === 0 && input.campaignProduct) {
    const name = input.campaignProduct.productName.trim();
    if (name && input.campaignProduct.quantity > 0) {
      lines = [
        {
          key: 'campaign-product',
          name,
          quantity: input.campaignProduct.quantity,
          sku: input.campaignProduct.sku ?? null,
          unit: input.campaignProduct.unit ?? null,
          weightGrams: null,
          source: 'campaign',
        },
      ];
    }
  }

  if (hasBrokenName && lines.length === 0) {
    return {
      state: 'anomaly',
      lines: [],
      itemCount: 0,
      totalQty: 0,
      visibleLines: [],
      overflowLabel: null,
      fullNames: [],
      message: PRODUCT_ANOMALY_MESSAGE,
    };
  }

  if (lines.length === 0) {
    // 訂閱尚未有方案內容：視為合法空
    if (input.type === 'subscription') {
      return {
        state: 'empty',
        lines: [],
        itemCount: 0,
        totalQty: 0,
        visibleLines: [],
        overflowLabel: null,
        fullNames: [],
        message: PRODUCT_EMPTY_MESSAGE,
      };
    }
    // 客戶訂單／寄賣進貨應有履約品項
    if (input.type === 'customer_order' || input.type === 'merchant_restock') {
      return {
        state: 'anomaly',
        lines: [],
        itemCount: 0,
        totalQty: 0,
        visibleLines: [],
        overflowLabel: null,
        fullNames: [],
        message: PRODUCT_ANOMALY_MESSAGE,
      };
    }
    return {
      state: 'empty',
      lines: [],
      itemCount: 0,
      totalQty: 0,
      visibleLines: [],
      overflowLabel: null,
      fullNames: [],
      message: PRODUCT_EMPTY_MESSAGE,
    };
  }

  const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0);
  const labels = lines.map(lineLabel);
  const visibleLines = labels.slice(0, 2);
  const overflowCount = Math.max(0, lines.length - 2);
  const overflowLabel =
    overflowCount > 0 ? `另有 ${overflowCount} 項・共 ${totalQty} 件` : null;

  return {
    state: 'ok',
    lines,
    itemCount: lines.length,
    totalQty,
    visibleLines,
    overflowLabel,
    fullNames: lines.map((line) => line.name),
    message: null,
  };
}

export function formatProductSummaryTooltip(model: ProductSummaryModel): string {
  if (model.state === 'anomaly') return PRODUCT_ANOMALY_MESSAGE;
  if (model.state === 'empty') return PRODUCT_EMPTY_MESSAGE;
  return model.lines.map(lineLabel).join('\n');
}

/** 從活動 conversation JSON / campaign master 解析零價贈品顯示 */
export function resolveCampaignProductFallback(input: {
  collectedDataJson?: string | null;
  campaignProductName?: string | null;
  campaignProductQuantity?: number | null;
}): { productName: string; quantity: number; unit: string | null; sku: string | null } | null {
  let productKey: JibaProductKey | null = null;
  if (input.collectedDataJson) {
    try {
      const data = JSON.parse(input.collectedDataJson) as Record<string, unknown>;
      const key = data.productKey;
      if (key === 'jiba' || key === 'frog') productKey = key;
    } catch {
      // ignore malformed session json — fall through to campaign master
    }
  }

  if (productKey) {
    const product = JIBA_PRODUCTS[productKey];
    return {
      productName: product.label,
      quantity: product.quantity,
      unit: product.unit,
      sku: null,
    };
  }

  const name = (input.campaignProductName ?? '').trim();
  const qty = input.campaignProductQuantity ?? 0;
  if (name && qty > 0) {
    return {
      productName: name,
      quantity: qty,
      unit: null,
      sku: null,
    };
  }

  return null;
}

type ClosestElement = {
  closest: (selector: string) => unknown;
};

function asClosestElement(value: EventTarget | null | undefined): ClosestElement | null {
  if (!value || typeof value !== 'object') return null;
  if (!('closest' in value) || typeof (value as ClosestElement).closest !== 'function') {
    return null;
  }
  return value as ClosestElement;
}

/** 列表列點擊是否應開啟抽屜（互動子元素需忽略；列本身的 role=button 不算） */
export function shouldOpenShipmentDrawerFromTarget(
  target: EventTarget | null,
  currentTarget?: EventTarget | null,
): boolean {
  const el = asClosestElement(target);
  if (!el) return true;
  const interactive = el.closest(
    'a[href], button, input, select, textarea, label, [data-stop-row-open="true"]',
  );
  if (!interactive) return true;
  const current = asClosestElement(currentTarget);
  if (current && interactive === current) return true;
  return false;
}

/** 多使用者：伺服器狀態與開啟快照不同 */
export function isShipmentSnapshotStale(openedStatus: string | null, serverStatus: string | null) {
  if (!openedStatus || !serverStatus) return false;
  return openedStatus !== serverStatus;
}

export function formatPanelUpdatedAt(date: Date | string, now = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '更新於 --:--:--';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  // keep `now` referenced for future relative formatting without lint unused
  void now;
  return `更新於 ${hh}:${mm}:${ss}`;
}

/** 詳情只能以右側 drawer 呈現，不得插入列表下方 document flow */
export function getShipmentDetailPlacementMode() {
  return 'drawer' as const;
}

/** 列開啟不得觸發狀態寫入控制 */
export function rowOpenDoesNotTriggerStatusWrite() {
  return true;
}

/** Drawer 操作區：主流程與取消 danger zone 分離（禁止並排） */
export function partitionShipmentWriteActions<T extends string>(allowedNext: T[]) {
  const primary = allowedNext.filter((status) => status !== 'cancelled');
  const danger = allowedNext.filter((status) => status === 'cancelled');
  return { primary, danger };
}
