import { createHash } from 'node:crypto';
import { snapshotHash, record, string, type Snapshot } from '../shopify/intake-policy';
import { MOONCAKE_CATALOG } from '../products/mooncake-catalog';
import type { OmsIssue } from './oms';
import {
  PROMOTION_GIFT_SKU, PROMOTION_RULES_VERSION, moneyToCents, multiplySafe,
  resolvePromotion, type PromotionReason, type PromotionResolution,
} from './promotion-resolver';
import type { ReviewDraft, ReviewProduct } from './review-policy';

export const FULFILLMENT_PLAN_VERSION = 'ck08-555-plan-v2';
const MAX_QTY = 2147483647;
const TEMPS = ['ambient', 'chilled', 'frozen'] as const;

export type FulfillmentOrigin = 'source' | 'hq-gift';
export type FulfillmentItem = {
  productId: string;
  productName: string;
  sku: string;
  sourceSku: string;
  status: string;
  productCategory: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isGift: boolean;
  origin: FulfillmentOrigin;
  temperature: string;
  catalogTemperature: string;
  includeInTemperature: boolean;
  unitCost?: number | null;
  weightGrams?: number | null;
  unit?: string | null;
  tierId?: string | null;
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
  details: string[];
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
    temperature: string; sku: string; sourceSku: string; status: string; productCategory: string;
    tierId: string | null; unitCost: number | null; catalogTemperature: string;
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

type GiftCatalogOk = {
  ok: true;
  product: ReviewProduct;
  tier: NonNullable<ReviewProduct['priceTiers']>[number];
  cost: number;
  temperature: string;
};
type GiftCatalogFail = { ok: false; kind: 'missing' | 'ambiguous' | 'invalid' | 'cost' | 'temperature'; message: string };
export type GiftCatalogResolution = GiftCatalogOk | GiftCatalogFail;

function issue(message: string, code: OmsIssue['code'] = 'ORDER_CHANGED'): OmsIssue {
  return { code, severity: 'blocking', message };
}

function validQuantity(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_QTY ? value : null;
}

function isCk08Product(product: ReviewProduct) {
  return product.sku === PROMOTION_GIFT_SKU || product.sourceSku === PROMOTION_GIFT_SKU;
}

export function canonicalMooncakeTier(product: ReviewProduct) {
  const ck08 = product.sku === MOONCAKE_CATALOG.sourceSku || product.sourceSku === MOONCAKE_CATALOG.sourceSku;
  if (!ck08) return null;
  const tiers = product.priceTiers ?? [];
  const matches = tiers.filter(tier =>
    tier.weightGrams === MOONCAKE_CATALOG.weightGrams && tier.unit === MOONCAKE_CATALOG.unit && tier.unitQty === 1);
  return matches.length === 1 && tiers.length === 1 ? matches[0] : null;
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null;
}

/** First present catalog cost wins; a present invalid value fails closed (0 is valid). */
function resolvedGiftCost(tier: { cost?: number | null } | null, product: ReviewProduct): number | null {
  for (const value of [tier?.cost, product.cost, MOONCAKE_CATALOG.cost]) {
    if (!present(value)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    return value;
  }
  return null;
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

export function resolveCampaignGiftProduct(products: ReviewProduct[]): GiftCatalogResolution {
  const candidates = campaignGiftCandidates(products);
  if (candidates.length === 0) {
    return { ok: false, kind: 'missing', message: '找不到可出貨的 CK-08 月餅商品，不能補贈' };
  }
  if (candidates.length > 1) {
    return { ok: false, kind: 'ambiguous', message: 'CK-08 對應到多筆商品，不能猜測補贈' };
  }
  const product = candidates[0];
  if (product.status !== 'active' || (product.productCategory ?? 'STANDARD') !== 'STANDARD') {
    return { ok: false, kind: 'invalid', message: 'CK-08 不是唯一有效的一般商品 50g／顆規格，不能補贈' };
  }
  const tier = canonicalMooncakeTier(product);
  if (!tier || !string(tier.id)) {
    return { ok: false, kind: 'invalid', message: 'CK-08 不是唯一的 50g／顆規格，不能猜測出貨' };
  }
  const cost = resolvedGiftCost(tier, product);
  if (cost === null) {
    return { ok: false, kind: 'cost', message: '活動贈品缺少有效成本，不能當成已確定可出貨' };
  }
  const temperature = string(product.defaultTemperature);
  if (!TEMPS.includes(temperature as typeof TEMPS[number])) {
    return { ok: false, kind: 'temperature', message: '活動贈品缺少有效商品溫層，不能預設常溫' };
  }
  return { ok: true, product, tier, cost, temperature };
}

function applyMooncakeSpec(product: ReviewProduct, issues: OmsIssue[], label: string) {
  if (!isCk08Product(product)) {
    if ((product.priceTiers ?? []).length > 0) {
      issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: `${label}包含多規格商品；本版尚未支援規格對應，不能直接出貨` });
      return { weightGrams: null as number | null, unit: null as string | null, tierId: null as string | null };
    }
    return { weightGrams: null as number | null, unit: null as string | null, tierId: null as string | null };
  }
  const tier = canonicalMooncakeTier(product);
  if (!tier) {
    issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: `${label}不是唯一的 50g／顆規格，不能猜測出貨` });
    return { weightGrams: null as number | null, unit: null as string | null, tierId: null as string | null };
  }
  return { weightGrams: MOONCAKE_CATALOG.weightGrams, unit: MOONCAKE_CATALOG.unit, tierId: string(tier.id) || null };
}

function addNeeded(needed: Record<string, number>, productId: string, quantity: number): boolean {
  const current = needed[productId] ?? 0;
  const next = current + quantity;
  if (!Number.isSafeInteger(next) || next > MAX_QTY) return false;
  needed[productId] = next;
  return true;
}

function ineligibleLabel(reason: PromotionReason): string {
  return reason === 'INELIGIBLE_BEFORE_CAMPAIGN' ? '活動期間外' : '未達門檻';
}

function statusFrom(promotion: PromotionResolution): { status: PromotionStatus; statusLabel: string } {
  switch (promotion.giftAction) {
    case 'add': return { status: 'hq_added', statusLabel: 'HQ補贈' };
    case 'existing': return { status: 'shopify_existing', statusLabel: 'Shopify已有' };
    case 'declined': return { status: 'declined', statusLabel: '已拒領' };
    case 'ineligible': return { status: 'ineligible', statusLabel: ineligibleLabel(promotion.reason) };
    default: return { status: 'uncertain', statusLabel: '待確認' };
  }
}

function displayOf(
  promotion: PromotionResolution,
  items: FulfillmentItem[],
  determinate: boolean,
  issues: OmsIssue[],
): PromotionSummaryView {
  const { status, statusLabel } = statusFrom(promotion);
  const campaignTitle = '活動贈品：滿NT$555贈月餅×1';
  const details = determinate ? [] : issues.map(row => row.message);
  if (!determinate) {
    return {
      campaignTitle, status: 'uncertain', statusLabel: '待確認', purchaseQuantity: null,
      campaignGiftQuantity: null, otherGiftQuantity: null, expectedShipQuantity: null,
      expectedShipLabel: '總數待確認', determinate: false, reason: promotion.reason, details,
    };
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
    reason: promotion.reason, details: [] };
}

function fingerprintOf(product: ReviewProduct, spec: { tierId: string | null }, cost: number | null): Pick<FulfillmentItem, 'sourceSku' | 'status' | 'productCategory' | 'tierId' | 'catalogTemperature'> & { unitCost: number | null } {
  return {
    sourceSku: product.sourceSku ?? '',
    status: product.status,
    productCategory: product.productCategory ?? 'STANDARD',
    tierId: spec.tierId,
    unitCost: cost,
    catalogTemperature: string(product.defaultTemperature),
  };
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
      sourceSku: item.sourceSku, status: item.status, productCategory: item.productCategory,
      tierId: item.tierId ?? null, unitCost: item.unitCost ?? null, catalogTemperature: item.catalogTemperature,
    })),
  };
}

export function fulfillmentPlanHash(frozen: FrozenFulfillmentPlan): string {
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) :
    value !== null && typeof value === 'object' ? Object.fromEntries(
      Object.keys(value as object).sort().map(key => [key, stable((value as Record<string, unknown>)[key])])) : value;
  return createHash('sha256').update(JSON.stringify(stable(frozen))).digest('hex');
}

function parsedCost(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return value;
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
    if (typeof item.sourceSku !== 'string' || typeof item.status !== 'string' || typeof item.productCategory !== 'string') return null;
    if (!('tierId' in item) || !('unitCost' in item) || typeof item.catalogTemperature !== 'string') return null;
    if (item.tierId !== null && typeof item.tierId !== 'string') return null;
    const unitCost = parsedCost(item.unitCost);
    if (unitCost === undefined) return null;
    if (typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) return null;
    if (typeof item.isGift !== 'boolean' || typeof item.unitPrice !== 'number' || typeof item.subtotal !== 'number') return null;
    return {
      productId: string(item.productId), quantity: item.quantity, isGift: item.isGift,
      origin: item.origin as FulfillmentOrigin, unitPrice: item.unitPrice, subtotal: item.subtotal,
      weightGrams: typeof item.weightGrams === 'number' ? item.weightGrams : null,
      unit: item.unit == null ? null : string(item.unit), temperature: string(item.temperature), sku: string(item.sku),
      sourceSku: item.sourceSku, status: item.status, productCategory: item.productCategory,
      tierId: item.tierId === null ? null : string(item.tierId), unitCost, catalogTemperature: item.catalogTemperature,
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
  const giftCatalog = resolveCampaignGiftProduct(products);
  let overflow = false;
  let giftCatalogIssued = false;
  let canCount = promotion.giftAction !== 'uncertain' && draft.lines.length === rows.length;

  if (draft.lines.length !== rows.length) {
    issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '商品對應數量與來源不一致' });
  }

  const applyGiftCatalogIssues = () => {
    if (giftCatalog.ok || giftCatalogIssued) return;
    giftCatalogIssued = true;
    const code: OmsIssue['code'] = giftCatalog.kind === 'temperature' ? 'TEMPERATURE_UNKNOWN' : 'PRODUCT_UNMAPPED';
    issues.push({ code, severity: 'blocking', message: giftCatalog.message });
    canCount = false;
  };

  rows.forEach((row, index) => {
    const choice = draft.lines[index];
    const campaignGift = campaignGiftSet.has(index);
    const product = products.find(item => item.id === choice?.productId && item.status === 'active');
    if (!product) {
      issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: `第 ${index + 1} 項商品尚未對應有效商品` });
      canCount = false;
    }
    if (campaignGift) {
      applyGiftCatalogIssues();
      if (giftCatalog.ok && product && product.id !== giftCatalog.product.id) {
        issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '來源活動贈品必須對應唯一有效的 CK-08 50g／顆商品' });
        canCount = false;
      }
    }
    if ((product?.productCategory ?? 'STANDARD') !== 'STANDARD' && product) {
      issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '包含換罐、服務或其他特殊商品，需要專用履約流程，不能當一般商品出貨' });
      canCount = false;
    }
    const quantity = validQuantity(row.quantity);
    if (!quantity) issues.push(issue(`第 ${index + 1} 項數量無效`));
    const unitCents = moneyToCents(row.price);
    if (unitCents === null) issues.push(issue(`第 ${index + 1} 項金額無效`));
    if (unitCents !== null && quantity && multiplySafe(unitCents, quantity) === null) {
      issues.push(issue(`第 ${index + 1} 項小計超過安全計算範圍`));
    }
    const physical = row.requires_shipping !== false;
    if (physical && !campaignGift && !TEMPS.includes((choice?.temperature ?? '') as typeof TEMPS[number])) {
      issues.push({ code: 'TEMPERATURE_UNKNOWN', severity: 'blocking', message: `第 ${index + 1} 項請確認商品溫層` });
    }
    if (!string(row.sku) && product) {
      issues.push({ code: 'SKU_MISSING', severity: 'warning', message: `第 ${index + 1} 項無來源 SKU，已人工指定商品` });
    }
    if (!product || !quantity || unitCents === null) {
      canCount = false;
      return;
    }
    const spec = applyMooncakeSpec(product, issues, `第 ${index + 1} 項`);
    if (isCk08Product(product) ? !canonicalMooncakeTier(product) : (product.priceTiers ?? []).length > 0) canCount = false;
    const unitPrice = campaignGift ? 0 : Number(row.price);
    const subtotal = campaignGift ? 0 : Math.round(Number(row.price) * 100) * quantity / 100;
    const isGift = campaignGift || Number(row.price) === 0;
    const giftCost = campaignGift && giftCatalog.ok ? giftCatalog.cost : null;
    if (campaignGift && giftCost === null) canCount = false;
    const temperature = campaignGift && giftCatalog.ok ? giftCatalog.temperature : choice.temperature;
    const print = fingerprintOf(product, spec, campaignGift ? giftCost : null);
    if (!addNeeded(needed, product.id, quantity)) overflow = true;
    items.push({
      productId: product.id, productName: product.name, sku: product.sku, quantity,
      unitPrice, subtotal, isGift, origin: 'source', temperature,
      weightGrams: spec.weightGrams, unit: spec.unit,
      sourceIndex: index, includeInTemperature: physical, ...print,
    });
  });

  if (promotion.giftAction === 'add') {
    applyGiftCatalogIssues();
    if (giftCatalog.ok) {
      const spec = applyMooncakeSpec(giftCatalog.product, issues, '活動贈品');
      const print = fingerprintOf(giftCatalog.product, spec, giftCatalog.cost);
      if (!addNeeded(needed, giftCatalog.product.id, 1)) overflow = true;
      items.push({
        productId: giftCatalog.product.id, productName: giftCatalog.product.name, sku: giftCatalog.product.sku,
        quantity: 1, unitPrice: 0, subtotal: 0, isGift: true, origin: 'hq-gift',
        temperature: giftCatalog.temperature,
        weightGrams: spec.weightGrams, unit: spec.unit, includeInTemperature: true, ...print,
      });
    }
  } else if (promotion.giftAction === 'existing') {
    applyGiftCatalogIssues();
  }

  if (overflow) {
    issues.push(issue('出貨數量合計超過安全計算範圍'));
    canCount = false;
  }

  const determinate = canCount && !overflow && !issues.some(row => row.severity === 'blocking');

  const planBase = {
    planVersion: FULFILLMENT_PLAN_VERSION, rulesVersion: PROMOTION_RULES_VERSION,
    sourceHash: snapshotHash(snapshot), promotion, items, neededQuantities: needed, issues,
  };
  const frozen = frozenFulfillmentPlan(planBase);
  return { ...planBase, frozen, frozenHash: fulfillmentPlanHash(frozen), display: displayOf(promotion, items, determinate, issues) };
}
