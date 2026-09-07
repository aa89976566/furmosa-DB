import { createHash } from 'node:crypto';
import { snapshotHash, record, string, type Snapshot } from '../shopify/intake-policy';
import { MOONCAKE_CATALOG } from '../products/mooncake-catalog';
import type { OmsIssue } from './oms';
import { PROMOTION_GIFT_SKU, PROMOTION_RULES_VERSION, resolvePromotion, type PromotionReason, type PromotionResolution } from './promotion-resolver';
import type { ReviewDraft, ReviewProduct } from './review-policy';

export const FULFILLMENT_PLAN_VERSION = 'ck08-555-plan-v1';
const MAX_QTY = 2147483647;

export type FulfillmentOrigin = 'source' | 'hq-gift';
export type FulfillmentItem = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isGift: boolean;
  origin: FulfillmentOrigin;
  temperature: string;
  unitCost?: number | null;
  weightGrams?: number | null;
  unit?: string | null;
  sourceIndex?: number;
};

export type PromotionStatus = 'hq_added' | 'shopify_existing' | 'declined' | 'ineligible' | 'uncertain';

export type PromotionSummaryView = {
  campaignTitle: string;
  status: PromotionStatus;
  statusLabel: string;
  purchaseQuantity: number | null;
  campaignGiftQuantity: number | null;
  otherGiftQuantity: number | null;
  expectedShipQuantity: number | null;
  expectedShipLabel: string;
  determinate: boolean;
  reason: PromotionReason;
};

export type FrozenFulfillmentPlan = {
  planVersion: string;
  rulesVersion: string;
  sourceHash: string;
  reason: PromotionReason;
  catalog: { sku: string; weightGrams: number; unit: string; unitQty: number };
  lines: {
    productId: string; quantity: number; isGift: boolean; origin: FulfillmentOrigin;
    unitPrice: number; subtotal: number; weightGrams: number | null; unit: string | null;
    temperature: string; sku: string;
  }[];
};

export type FulfillmentPlan = {
  planVersion: string;
  rulesVersion: string;
  sourceHash: string;
  promotion: PromotionResolution;
  items: FulfillmentItem[];
  neededQuantities: Record<string, number>;
  issues: OmsIssue[];
  frozen: FrozenFulfillmentPlan;
  frozenHash: string;
  display: PromotionSummaryView;
};

function issue(message: string, code: OmsIssue['code'] = 'ORDER_CHANGED'): OmsIssue {
  return { code, severity: 'blocking', message };
}

function moneyValid(value: unknown): boolean {
  return typeof value === 'string' && /^\d+(?:\.\d{1,2})?$/.test(value)
    && Number.isSafeInteger(Math.round(Number(value) * 100));
}

function validQuantity(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_QTY ? value : null;
}

export function canonicalMooncakeTier(product: ReviewProduct) {
  const ck08 = product.sku === MOONCAKE_CATALOG.sourceSku || product.sourceSku === MOONCAKE_CATALOG.sourceSku;
  if (!ck08) return null;
  const tiers = product.priceTiers ?? [];
  const matches = tiers.filter(tier =>
    tier.weightGrams === MOONCAKE_CATALOG.weightGrams && tier.unit === MOONCAKE_CATALOG.unit && tier.unitQty === 1);
  return matches.length === 1 && tiers.length === 1 ? matches[0] : null;
}

function isCk08Product(product: ReviewProduct) {
  return product.sku === PROMOTION_GIFT_SKU || product.sourceSku === PROMOTION_GIFT_SKU;
}

function campaignGiftCandidates(products: ReviewProduct[]) {
  const seen = new Set<string>();
  return products.filter(product => {
    if (!isCk08Product(product)) return false;
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

function uniqueGiftProduct(products: ReviewProduct[]): ReviewProduct | null | 'ambiguous' | 'invalid' {
  const candidates = campaignGiftCandidates(products);
  if (candidates.length === 0) return null;
  if (candidates.length > 1) return 'ambiguous';
  const product = candidates[0];
  if (product.status !== 'active' || (product.productCategory ?? 'STANDARD') !== 'STANDARD') return 'invalid';
  if (!canonicalMooncakeTier(product)) return 'invalid';
  return product;
}

function applyMooncakeSpec(product: ReviewProduct, issues: OmsIssue[], label: string) {
  if (!isCk08Product(product)) {
    if ((product.priceTiers ?? []).length > 0) {
      issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: `${label}包含多規格商品；本版尚未支援規格對應，不能直接出貨` });
      return { weightGrams: null as number | null, unit: null as string | null };
    }
    return { weightGrams: null as number | null, unit: null as string | null };
  }
  const tier = canonicalMooncakeTier(product);
  if (!tier) {
    issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: `${label}不是唯一的 50g／顆規格，不能猜測出貨` });
    return { weightGrams: null as number | null, unit: null as string | null };
  }
  return { weightGrams: MOONCAKE_CATALOG.weightGrams, unit: MOONCAKE_CATALOG.unit };
}

function giftUnitCost(product: ReviewProduct): number | null {
  const tier = canonicalMooncakeTier(product);
  const cost = tier?.cost ?? product.cost ?? MOONCAKE_CATALOG.cost;
  return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 && Number.isSafeInteger(Math.round(cost * 100))
    ? cost : null;
}

function addNeeded(needed: Record<string, number>, productId: string, quantity: number): boolean {
  const current = needed[productId] ?? 0;
  const next = current + quantity;
  if (!Number.isSafeInteger(next) || next > MAX_QTY) return false;
  needed[productId] = next;
  return true;
}

function statusFrom(promotion: PromotionResolution): { status: PromotionStatus; statusLabel: string } {
  switch (promotion.giftAction) {
    case 'add': return { status: 'hq_added', statusLabel: 'HQ補贈' };
    case 'existing': return { status: 'shopify_existing', statusLabel: 'Shopify已有' };
    case 'declined': return { status: 'declined', statusLabel: '已拒領' };
    case 'ineligible': return { status: 'ineligible', statusLabel: '未達門檻' };
    default: return { status: 'uncertain', statusLabel: '待確認' };
  }
}

function displayOf(promotion: PromotionResolution, items: FulfillmentItem[], determinate: boolean): PromotionSummaryView {
  const { status, statusLabel } = statusFrom(promotion);
  const campaignTitle = '活動贈品：滿NT$555贈月餅×1';
  if (!determinate) {
    return { campaignTitle, status: 'uncertain', statusLabel: '待確認', purchaseQuantity: null,
      campaignGiftQuantity: null, otherGiftQuantity: null, expectedShipQuantity: null,
      expectedShipLabel: '總數待確認', determinate: false, reason: promotion.reason };
  }
  const purchaseQuantity = items.filter(item => !item.isGift).reduce((sum, item) => sum + item.quantity, 0);
  const campaignGiftQuantity = items.filter(item => item.isGift && (item.origin === 'hq-gift' || promotion.existingGiftIndexes.includes(item.sourceIndex ?? -1)))
    .reduce((sum, item) => sum + item.quantity, 0);
  const campaignIds = new Set(items.filter(item => item.isGift && (item.origin === 'hq-gift' || promotion.existingGiftIndexes.includes(item.sourceIndex ?? -1))).map(item => `${item.origin}:${item.sourceIndex ?? 'hq'}`));
  const otherGiftQuantity = items.filter(item => item.isGift && !campaignIds.has(`${item.origin}:${item.sourceIndex ?? 'hq'}`))
    .reduce((sum, item) => sum + item.quantity, 0);
  const expectedShipQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const units = [...new Set(items.map(item => item.unit || '件'))];
  const unitLabel = units.length === 1 ? String(units[0]) : '件';
  return { campaignTitle, status, statusLabel, purchaseQuantity, campaignGiftQuantity, otherGiftQuantity,
    expectedShipQuantity, expectedShipLabel: `預計出貨 ${expectedShipQuantity} ${unitLabel}`, determinate: true,
    reason: promotion.reason };
}

export function frozenFulfillmentPlan(plan: Pick<FulfillmentPlan, 'planVersion' | 'rulesVersion' | 'sourceHash' | 'promotion' | 'items'>): FrozenFulfillmentPlan {
  return {
    planVersion: plan.planVersion,
    rulesVersion: plan.rulesVersion,
    sourceHash: plan.sourceHash,
    reason: plan.promotion.reason,
    catalog: { sku: MOONCAKE_CATALOG.sourceSku, weightGrams: MOONCAKE_CATALOG.weightGrams, unit: MOONCAKE_CATALOG.unit, unitQty: 1 },
    lines: plan.items.map(item => ({
      productId: item.productId, quantity: item.quantity, isGift: item.isGift, origin: item.origin,
      unitPrice: item.unitPrice, subtotal: item.subtotal, weightGrams: item.weightGrams ?? null,
      unit: item.unit ?? null, temperature: item.temperature, sku: item.sku,
    })),
  };
}

export function fulfillmentPlanHash(frozen: FrozenFulfillmentPlan): string {
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) :
    value !== null && typeof value === 'object' ? Object.fromEntries(
      Object.keys(value as object).sort().map(key => [key, stable((value as Record<string, unknown>)[key])])) : value;
  return createHash('sha256').update(JSON.stringify(stable(frozen))).digest('hex');
}

export function parseFrozenFulfillmentPlan(value: unknown): FrozenFulfillmentPlan | null {
  const data = record(value);
  if (string(data.planVersion) !== FULFILLMENT_PLAN_VERSION || string(data.rulesVersion) !== PROMOTION_RULES_VERSION) return null;
  if (!string(data.sourceHash) || !string(data.reason) || !Array.isArray(data.lines)) return null;
  const catalog = record(data.catalog);
  if (string(catalog.sku) !== MOONCAKE_CATALOG.sourceSku || catalog.weightGrams !== MOONCAKE_CATALOG.weightGrams
    || string(catalog.unit) !== MOONCAKE_CATALOG.unit || catalog.unitQty !== 1) return null;
  const lines = data.lines.map(row => {
    const item = record(row);
    if (!string(item.productId) || !string(item.sku) || (item.origin !== 'source' && item.origin !== 'hq-gift')) return null;
    if (typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) return null;
    if (typeof item.isGift !== 'boolean' || typeof item.unitPrice !== 'number' || typeof item.subtotal !== 'number') return null;
    return {
      productId: string(item.productId), quantity: item.quantity, isGift: item.isGift,
      origin: item.origin as FulfillmentOrigin, unitPrice: item.unitPrice, subtotal: item.subtotal,
      weightGrams: typeof item.weightGrams === 'number' ? item.weightGrams : null,
      unit: item.unit == null ? null : string(item.unit), temperature: string(item.temperature), sku: string(item.sku),
    };
  });
  if (lines.some(line => line === null)) return null;
  return { planVersion: FULFILLMENT_PLAN_VERSION, rulesVersion: PROMOTION_RULES_VERSION, sourceHash: string(data.sourceHash),
    reason: data.reason as PromotionReason, catalog: { sku: MOONCAKE_CATALOG.sourceSku, weightGrams: MOONCAKE_CATALOG.weightGrams,
      unit: MOONCAKE_CATALOG.unit, unitQty: 1 }, lines: lines as FrozenFulfillmentPlan['lines'] };
}

export function buildFulfillmentPlan(snapshot: Snapshot, draft: ReviewDraft, products: ReviewProduct[]): FulfillmentPlan {
  const promotion = resolvePromotion(snapshot);
  const issues: OmsIssue[] = [...promotion.issues];
  const rows = Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items.map(record) : [];
  const items: FulfillmentItem[] = [];
  const needed: Record<string, number> = {};
  const campaignGiftSet = new Set(promotion.existingGiftIndexes);
  let overflow = false;
  let canCount = promotion.giftAction !== 'uncertain' && draft.lines.length === rows.length;

  if (draft.lines.length !== rows.length) {
    issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '商品對應數量與來源不一致' });
  }

  rows.forEach((row, index) => {
    const choice = draft.lines[index];
    const product = products.find(item => item.id === choice?.productId && item.status === 'active');
    if (!product) {
      issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: `第 ${index + 1} 項商品尚未對應有效商品` });
      canCount = false;
    }
    if ((product?.productCategory ?? 'STANDARD') !== 'STANDARD' && product) {
      issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '包含換罐、服務或其他特殊商品，需要專用履約流程，不能當一般商品出貨' });
      canCount = false;
    }
    const quantity = validQuantity(row.quantity);
    if (!quantity) issues.push(issue(`第 ${index + 1} 項數量無效`));
    const validPrice = moneyValid(row.price);
    if (!validPrice) issues.push(issue(`第 ${index + 1} 項金額無效`));
    if (validPrice && quantity && !Number.isSafeInteger(Math.round(Number(row.price) * 100) * quantity)) {
      issues.push(issue(`第 ${index + 1} 項小計超過安全計算範圍`));
    }
    if (row.requires_shipping !== false) {
      if (!['ambient', 'chilled', 'frozen'].includes(choice?.temperature ?? '')) {
        issues.push({ code: 'TEMPERATURE_UNKNOWN', severity: 'blocking', message: `第 ${index + 1} 項請確認商品溫層` });
      }
    }
    if (!string(row.sku) && product) {
      issues.push({ code: 'SKU_MISSING', severity: 'warning', message: `第 ${index + 1} 項無來源 SKU，已人工指定商品` });
    }
    if (!product || !quantity || !validPrice) {
      canCount = false;
      return;
    }
    const campaignGift = campaignGiftSet.has(index);
    const spec = applyMooncakeSpec(product, issues, `第 ${index + 1} 項`);
    if (isCk08Product(product) ? !canonicalMooncakeTier(product) : (product.priceTiers ?? []).length > 0) canCount = false;
    const unitPrice = campaignGift ? 0 : Number(row.price);
    const subtotal = campaignGift ? 0 : Math.round(Number(row.price) * 100) * quantity / 100;
    const isGift = campaignGift || Number(row.price) === 0;
    if (!addNeeded(needed, product.id, quantity)) overflow = true;
    items.push({
      productId: product.id, productName: product.name, sku: product.sku, quantity,
      unitPrice, subtotal, isGift, origin: 'source', temperature: choice.temperature,
      unitCost: campaignGift ? giftUnitCost(product) : null, weightGrams: spec.weightGrams, unit: spec.unit, sourceIndex: index,
    });
  });

  if (promotion.giftAction === 'add') {
    const gift = uniqueGiftProduct(products);
    if (gift === null) {
      issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '找不到可出貨的 CK-08 月餅商品，不能補贈' });
      canCount = false;
    } else if (gift === 'ambiguous') {
      issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: 'CK-08 對應到多筆商品，不能猜測補贈' });
      canCount = false;
    } else if (gift === 'invalid') {
      issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: 'CK-08 不是唯一有效的一般商品 50g／顆規格，不能補贈' });
      canCount = false;
    } else {
      const spec = applyMooncakeSpec(gift, issues, '活動贈品');
      const cost = giftUnitCost(gift);
      if (cost === null) issues.push(issue('活動贈品缺少有效成本，不能補贈'));
      const giftTemp = gift.defaultTemperature ?? '';
      if (!['ambient', 'chilled', 'frozen'].includes(giftTemp)) {
        issues.push({ code: 'TEMPERATURE_UNKNOWN', severity: 'blocking', message: '活動贈品缺少有效商品溫層，不能預設常溫' });
      }
      if (!addNeeded(needed, gift.id, 1)) overflow = true;
      items.push({
        productId: gift.id, productName: gift.name, sku: gift.sku, quantity: 1,
        unitPrice: 0, subtotal: 0, isGift: true, origin: 'hq-gift', temperature: giftTemp,
        unitCost: cost, weightGrams: spec.weightGrams, unit: spec.unit,
      });
    }
  } else if (promotion.giftAction === 'existing') {
    for (const item of items) {
      if (!campaignGiftSet.has(item.sourceIndex ?? -1)) continue;
      const product = products.find(row => row.id === item.productId);
      if (!product || !canonicalMooncakeTier(product) || product.status !== 'active'
        || (product.productCategory ?? 'STANDARD') !== 'STANDARD') {
        issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '來源活動贈品必須對應唯一有效的 CK-08 50g／顆商品' });
        canCount = false;
      }
    }
  }

  if (overflow) {
    issues.push(issue('出貨數量合計超過安全計算範圍'));
    canCount = false;
  }

  const determinate = canCount && !overflow;

  const planBase = {
    planVersion: FULFILLMENT_PLAN_VERSION, rulesVersion: PROMOTION_RULES_VERSION,
    sourceHash: snapshotHash(snapshot), promotion, items, neededQuantities: needed, issues,
  };
  const frozen = frozenFulfillmentPlan(planBase);
  return { ...planBase, frozen, frozenHash: fulfillmentPlanHash(frozen), display: displayOf(promotion, items, determinate) };
}
