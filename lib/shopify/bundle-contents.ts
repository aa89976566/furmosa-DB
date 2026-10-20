import { snapshotView } from '@/lib/shopify/snapshot-view';

export type BundleDisplay = {
  variantLabel: string;
  contentsLabel: string;
};

type BundleComponent = {
  name: string;
  weightGrams?: number;
  quantity: number;
  unit: string;
};

type BundleDefinition = {
  productTitle: string;
  variantTitle: string;
  components: BundleComponent[];
};

/**
 * 已確認的 Shopify 組合方案。
 *
 * 出貨畫面只依訂單快照中的商品與方案名稱查表，不解析會變動的商品描述，
 * 因此歷史訂單不會因 Shopify 日後改文案而顯示成另一組內容。
 */
const BUNDLE_DEFINITIONS: BundleDefinition[] = [
  {
    productTitle: '貝貝團購好友限定優惠',
    variantTitle: '人氣款',
    components: [
      { name: '嚎大大雞排', quantity: 3, unit: '片' },
      { name: '豬耳朵', weightGrams: 30, quantity: 1, unit: '份' },
    ],
  },
  {
    productTitle: '貝貝團購好友限定優惠',
    variantTitle: '豪華款',
    components: [
      { name: '嚎大大雞排', quantity: 3, unit: '片' },
      { name: '豬蛋蛋', weightGrams: 30, quantity: 1, unit: '份' },
    ],
  },
];

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-TW');
}

function componentLabel(component: BundleComponent, bundleQuantity: number): string {
  const weight = component.weightGrams ? ` ${component.weightGrams}g` : '';
  return `${component.name}${weight} ×${component.quantity * bundleQuantity} ${component.unit}`;
}

/** 只有商品名稱及方案皆能精確對上時才顯示內容，避免用相似名稱猜測。 */
export function resolveShopifyBundleDisplay(
  snapshot: unknown,
  shipmentProductName: string,
  shipmentQuantity: number,
): BundleDisplay | null {
  if (!Number.isSafeInteger(shipmentQuantity) || shipmentQuantity <= 0) return null;

  const sourceItem = snapshotView(snapshot)?.items.find(
    (item) => normalize(item.title) === normalize(shipmentProductName),
  );
  if (!sourceItem?.variantTitle) return null;

  const definition = BUNDLE_DEFINITIONS.find(
    (candidate) =>
      normalize(candidate.productTitle) === normalize(sourceItem.title) &&
      normalize(candidate.variantTitle) === normalize(sourceItem.variantTitle),
  );
  if (!definition) return null;

  return {
    variantLabel: definition.variantTitle,
    contentsLabel: definition.components
      .map((component) => componentLabel(component, shipmentQuantity))
      .join('、'),
  };
}
