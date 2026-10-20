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
  shopifyVariantId: string;
  shopifySku: string;
  components: BundleComponent[];
};

/**
 * 已確認的 Shopify 組合方案。
 *
 * 出貨畫面只依訂單快照中的商品與方案名稱查表，不解析會變動的商品描述，
 * 因此歷史訂單不會因 Shopify 日後改文案而顯示成另一組內容。
 */
export const BB_BUNDLE_VARIANTS: readonly BundleDefinition[] = [
  {
    productTitle: '貝貝團購好友限定優惠',
    variantTitle: '人氣款',
    shopifyVariantId: '64613120082297',
    shopifySku: 'BB-POPULAR-SET',
    components: [
      { name: '原味雞霸', quantity: 3, unit: '片' },
      { name: '豬耳朵片', weightGrams: 30, quantity: 1, unit: '份' },
    ],
  },
  {
    productTitle: '貝貝團購好友限定優惠',
    variantTitle: '豪華款',
    shopifyVariantId: '64613120115065',
    shopifySku: 'BB-DELUXE-SET',
    components: [
      { name: '原味雞霸', quantity: 3, unit: '片' },
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

const BUNDLE_NOTE_PREFIX = '組合內容：';

/** 新訂單會把 HQ 規格備註快照到出貨品項；以快照優先，保留歷史真相。 */
export function bundleContentsFromShipmentNotes(
  notes: string | null | undefined,
  bundleQuantity: number,
): string | null {
  const line = notes
    ?.split(/\r?\n|；/)
    .map((value) => value.trim())
    .find((value) => value.startsWith(BUNDLE_NOTE_PREFIX));
  if (!line || !Number.isSafeInteger(bundleQuantity) || bundleQuantity <= 0) return null;
  const contents = line.slice(BUNDLE_NOTE_PREFIX.length).trim();
  if (!contents) return null;
  return contents.replace(/×\s*(\d+)/g, (_match, raw: string) => {
    const quantity = Number(raw);
    return Number.isSafeInteger(quantity) && quantity > 0
      ? `×${quantity * bundleQuantity}`
      : _match;
  });
}

/** 只有商品名稱及方案皆能精確對上時才顯示內容，避免用相似名稱猜測。 */
export function resolveShopifyBundleDisplay(
  snapshot: unknown,
  shipmentProductName: string,
  shipmentQuantity: number,
  shipmentNotes?: string | null,
): BundleDisplay | null {
  if (!Number.isSafeInteger(shipmentQuantity) || shipmentQuantity <= 0) return null;

  const sourceItem = snapshotView(snapshot)?.items.find(
    (item) => normalize(item.title) === normalize(shipmentProductName),
  );
  if (!sourceItem?.variantTitle) return null;

  const definition = BB_BUNDLE_VARIANTS.find(
    (candidate) =>
      normalize(candidate.productTitle) === normalize(sourceItem.title) &&
      normalize(candidate.variantTitle) === normalize(sourceItem.variantTitle),
  );
  if (!definition) return null;

  return {
    variantLabel: definition.variantTitle,
    contentsLabel:
      bundleContentsFromShipmentNotes(shipmentNotes, shipmentQuantity) ??
      definition.components
        .map((component) => componentLabel(component, shipmentQuantity))
        .join('、'),
  };
}
