import { record, string, sourceDate, hasPromotionCapture, PROMOTION_GIFT_MARKER, PROMOTION_CHOICE_ATTRIBUTE, type Snapshot } from '../shopify/intake-policy';
import type { OmsIssue } from './oms';

export const PROMOTION_RULES_VERSION = 'ck08-555-v1';
export const PROMOTION_THRESHOLD_CENTS = 55500;
export const PROMOTION_GIFT_SKU = 'CK-08';
export const PROMOTION_GIFT_VARIANT_ID = '64368368517497';
export const PROMOTION_START_MS = Date.parse('2026-08-27T06:55:00+08:00');
const MAX_QTY = 2147483647;

export type PromotionReason =
  | 'INELIGIBLE_BELOW_THRESHOLD'
  | 'INELIGIBLE_BEFORE_CAMPAIGN'
  | 'ADD_HQ_GIFT'
  | 'SHOPIFY_EXISTING_GIFT'
  | 'DECLINED'
  | 'MISSING_CAPTURE'
  | 'INVALID_MONEY'
  | 'INVALID_DATE'
  | 'INVALID_QUANTITY'
  | 'OVERFLOW'
  | 'CONTRADICTION'
  | 'MULTIPLE_GIFTS'
  | 'UNKNOWN_CHOICE';

export type PromotionResolution = {
  rulesVersion: string;
  captureComplete: boolean;
  qualifyingCents: number | null;
  giftAction: 'add' | 'existing' | 'declined' | 'ineligible' | 'uncertain';
  reason: PromotionReason;
  existingGiftIndexes: number[];
  existingGiftQuantity: number;
  issues: OmsIssue[];
};

function moneyCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

function validQuantity(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_QTY ? value : null;
}

function addCents(current: number, extra: number): number | null {
  const sum = current + extra;
  return Number.isSafeInteger(sum) && sum >= 0 && sum <= Number.MAX_SAFE_INTEGER ? sum : null;
}

function lineNetCents(row: Record<string, unknown>): number | null {
  const price = moneyCents(row.price);
  const quantity = validQuantity(row.quantity);
  const discount = row.total_discount === undefined || row.total_discount === null ? 0 : moneyCents(row.total_discount);
  if (price === null || quantity === null || discount === null) return null;
  const gross = price * quantity;
  if (!Number.isSafeInteger(gross) || gross < 0 || discount > gross) return null;
  return gross - discount;
}

export function isCk08Identity(row: Record<string, unknown>): boolean {
  return string(row.sku) === PROMOTION_GIFT_SKU || string(row.variant_id) === PROMOTION_GIFT_VARIANT_ID;
}

function markerValues(row: Record<string, unknown>): string[] {
  const props = row.properties;
  if (!Array.isArray(props)) return [];
  return props.map(item => record(item)).filter(item => string(item.name) === PROMOTION_GIFT_MARKER)
    .map(item => string(item.value));
}

function choiceValues(snapshot: Snapshot): string[] {
  const rows = Array.isArray(snapshot.order.note_attributes) ? snapshot.order.note_attributes.map(record) : [];
  return rows.filter(row => string(row.name) === PROMOTION_CHOICE_ATTRIBUTE).map(row => string(row.value)).filter(Boolean);
}

function issue(message: string, code: OmsIssue['code'] = 'ORDER_CHANGED'): OmsIssue {
  return { code, severity: 'blocking', message };
}

export function resolvePromotion(snapshot: Snapshot): PromotionResolution {
  const captureComplete = hasPromotionCapture(snapshot);
  const base = { rulesVersion: PROMOTION_RULES_VERSION, captureComplete,
    qualifyingCents: null as number | null, existingGiftIndexes: [] as number[], existingGiftQuantity: 0 };
  const created = sourceDate(snapshot.order.created_at);
  const rows = Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items.map(record) : [];
  if (!snapshot.order.currency || snapshot.order.currency !== 'TWD') {
    return { ...base, giftAction: 'uncertain', reason: 'INVALID_MONEY', issues: [issue('非 TWD 不可計算滿額贈品')] };
  }

  let qualifying: number | null = 0;
  const giftIndexes: number[] = [];
  let giftQty = 0;
  let moneyInvalid = false;
  let qtyInvalid = false;
  let overflow = false;
  let contradiction = false;

  for (const [index, row] of rows.entries()) {
    const quantity = validQuantity(row.quantity);
    if (quantity === null) qtyInvalid = true;
    const net = lineNetCents(row);
    if (net === null) moneyInvalid = true;
    const markers = markerValues(row);
    const distinctMarkers = [...new Set(markers)];
    const markedTrue = distinctMarkers.length === 1 && distinctMarkers[0] === 'true';
    const markedOther = distinctMarkers.some(value => value !== 'true');
    const ck08 = isCk08Identity(row);
    const lineContradiction = distinctMarkers.length > 1 || markedOther || (markedTrue && !ck08)
      || (markedTrue && net !== null && net !== 0);
    if (lineContradiction) contradiction = true;
    const isCampaignGift = captureComplete && ck08 && net === 0 && !lineContradiction;
    if (isCampaignGift && quantity) {
      giftIndexes.push(index);
      const next = giftQty + quantity;
      if (!Number.isSafeInteger(next) || next > MAX_QTY) overflow = true;
      else giftQty = next;
    }
    // Pre-discount line subtotal of non-campaign-gift rows. Possible CK-08 net-0 gifts are excluded
    // even without capture so a 79-dollar gift line cannot push a below-threshold order over 555.
    if (qualifying !== null && quantity !== null && !(ck08 && net === 0)) {
      const price = moneyCents(row.price);
      if (price === null) { moneyInvalid = true; qualifying = null; }
      else {
        const line = price * quantity;
        if (!Number.isSafeInteger(line)) { overflow = true; qualifying = null; }
        else {
          qualifying = addCents(qualifying, line);
          if (qualifying === null) overflow = true;
        }
      }
    }
  }

  const choices = choiceValues(snapshot);
  const distinctChoices = [...new Set(choices)];
  if (distinctChoices.length > 1) contradiction = true;
  const choice = distinctChoices.length === 1 ? distinctChoices[0] : '';

  const result = (giftAction: PromotionResolution['giftAction'], reason: PromotionReason, extra: OmsIssue[] = []): PromotionResolution => ({
    ...base, qualifyingCents: qualifying, giftAction, reason, existingGiftIndexes: giftIndexes,
    existingGiftQuantity: giftQty, issues: extra,
  });

  if (overflow) return result('uncertain', 'OVERFLOW', [issue('活動金額或數量超過安全計算範圍')]);
  if (qtyInvalid) return result('uncertain', 'INVALID_QUANTITY', [issue('來源數量無效，無法計算贈品')]);
  if (moneyInvalid || qualifying === null) {
    return result('uncertain', 'INVALID_MONEY', [issue('活動金額格式無效，無法計算贈品')]);
  }
  if (contradiction) return result('uncertain', 'CONTRADICTION', [issue('活動贈品標記、款式或顧客選擇互相矛盾，請核對 Shopify')]);
  if (giftQty > 1 || giftIndexes.length > 1) return result('uncertain', 'MULTIPLE_GIFTS', [issue('來源已有超過一顆本活動贈品，請核對後再出貨')]);

  const reached = qualifying >= PROMOTION_THRESHOLD_CENTS;
  if (!created) {
    return reached
      ? result('uncertain', 'INVALID_DATE', [issue('達門檻但缺少有效下單時間，無法判定活動')])
      : result('ineligible', 'INELIGIBLE_BELOW_THRESHOLD');
  }
  if (created.getTime() < PROMOTION_START_MS) return result('ineligible', 'INELIGIBLE_BEFORE_CAMPAIGN');
  if (!reached) return result('ineligible', 'INELIGIBLE_BELOW_THRESHOLD');
  if (!captureComplete) {
    return result('uncertain', 'MISSING_CAPTURE', [issue('達門檻但來源缺少活動標記，請重新同步 Shopify 後再審核')]);
  }
  if (choice === 'decline') {
    if (giftQty > 0) return result('uncertain', 'CONTRADICTION', [issue('顧客已拒領，但來源仍有本活動贈品')]);
    return result('declined', 'DECLINED');
  }
  if (choice && choice !== 'keep') return result('uncertain', 'UNKNOWN_CHOICE', [issue('顧客月餅選擇無法判定')]);
  if (giftQty === 1) return result('existing', 'SHOPIFY_EXISTING_GIFT');
  return result('add', 'ADD_HQ_GIFT');
}
