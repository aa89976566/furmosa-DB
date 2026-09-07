import { record, string, sourceDate, hasPromotionCapture, PROMOTION_GIFT_MARKER, PROMOTION_CHOICE_ATTRIBUTE, type Snapshot } from '../shopify/intake-policy';
import type { OmsIssue } from './oms';

export const PROMOTION_RULES_VERSION = 'ck08-555-v1';
export const PROMOTION_THRESHOLD_CENTS = 55500;
export const PROMOTION_GIFT_SKU = 'CK-08';
export const PROMOTION_GIFT_VARIANT_ID = '64368368517497';
export const PROMOTION_START_MS = Date.parse('2026-08-27T06:55:00+08:00');
const MAX_QTY = 2147483647;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

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
  | 'IDENTITY_CONFLICT'
  | 'DUPLICATE_MARKER'
  | 'INVALID_MARKER'
  | 'DUPLICATE_CHOICE'
  | 'INVALID_CHOICE'
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

/** Integer-cent money from a Shopify decimal string. No float multiply-then-round. */
export function moneyToCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, frac = ''] = value.split('.');
  try {
    const cents = BigInt(whole) * 100n + BigInt((frac + '00').slice(0, 2));
    if (cents < 0n || cents > MAX_SAFE) return null;
    const n = Number(cents);
    return Number.isSafeInteger(n) ? n : null;
  } catch { return null; }
}

export function multiplySafe(a: number, b: number): number | null {
  try {
    const n = BigInt(a) * BigInt(b);
    if (n < 0n || n > MAX_SAFE) return null;
    const v = Number(n);
    return Number.isSafeInteger(v) ? v : null;
  } catch { return null; }
}

export function addSafe(a: number, b: number): number | null {
  try {
    const n = BigInt(a) + BigInt(b);
    if (n < 0n || n > MAX_SAFE) return null;
    const v = Number(n);
    return Number.isSafeInteger(v) ? v : null;
  } catch { return null; }
}

function validQuantity(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_QTY ? value : null;
}

function lineNetCents(row: Record<string, unknown>): number | null {
  const price = moneyToCents(row.price);
  const quantity = validQuantity(row.quantity);
  const discount = row.total_discount === undefined || row.total_discount === null ? 0 : moneyToCents(row.total_discount);
  if (price === null || quantity === null || discount === null) return null;
  const gross = multiplySafe(price, quantity);
  if (gross === null || discount > gross) return null;
  return addSafe(gross, -discount);
}

export type IdentityState = 'match' | 'other' | 'conflict';

export function lineIdentityState(row: Record<string, unknown>): IdentityState {
  const sku = string(row.sku);
  const variant = string(row.variant_id);
  const skuMatch = sku === PROMOTION_GIFT_SKU;
  const variantMatch = variant === PROMOTION_GIFT_VARIANT_ID;
  if (sku && variant) {
    if (skuMatch !== variantMatch) return 'conflict';
    return skuMatch && variantMatch ? 'match' : 'other';
  }
  if (sku && skuMatch) return 'match';
  if (variant && variantMatch) return 'match';
  return 'other';
}

function markerValues(row: Record<string, unknown>): unknown[] {
  const props = row.properties;
  if (!Array.isArray(props)) return [];
  return props.map(item => record(item)).filter(item => string(item.name) === PROMOTION_GIFT_MARKER).map(item => item.value);
}

function choiceEntries(snapshot: Snapshot): unknown[] {
  const rows = Array.isArray(snapshot.order.note_attributes) ? snapshot.order.note_attributes.map(record) : [];
  return rows.filter(row => string(row.name) === PROMOTION_CHOICE_ATTRIBUTE).map(row => row.value);
}

function token(value: unknown): { kind: 'string'; text: string } | { kind: 'invalid' } {
  if (typeof value !== 'string') return { kind: 'invalid' };
  return { kind: 'string', text: value.trim() };
}

function hasRealCalendarDate(value: unknown): boolean {
  const text = string(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month];
}

function looksLikeDatetime(value: unknown): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(string(value));
}

function issue(message: string, code: OmsIssue['code'] = 'ORDER_CHANGED'): OmsIssue {
  return { code, severity: 'blocking', message };
}

export function resolvePromotion(snapshot: Snapshot): PromotionResolution {
  const captureComplete = hasPromotionCapture(snapshot);
  const base = { rulesVersion: PROMOTION_RULES_VERSION, captureComplete,
    qualifyingCents: null as number | null, existingGiftIndexes: [] as number[], existingGiftQuantity: 0 };
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
  let identityConflict = false;
  let duplicateMarker = false;
  let invalidMarker = false;
  let paidOrWrongMarker = false;

  for (const [index, row] of rows.entries()) {
    const quantity = validQuantity(row.quantity);
    if (quantity === null) qtyInvalid = true;
    const net = lineNetCents(row);
    if (net === null) moneyInvalid = true;
    const identity = lineIdentityState(row);
    if (identity === 'conflict') identityConflict = true;
    const markers = markerValues(row);
    if (markers.length > 1) duplicateMarker = true;
    const marker = markers.length === 1 ? token(markers[0]) : null;
    if (markers.length === 1 && (marker?.kind !== 'string' || (marker.text !== 'true' && marker.text !== ''))) invalidMarker = true;
    if (markers.length === 1 && marker?.kind === 'string' && marker.text === '') invalidMarker = true;
    const markedTrue = markers.length === 1 && marker?.kind === 'string' && marker.text === 'true';
    if (markedTrue && identity !== 'match') paidOrWrongMarker = true;
    if (markedTrue && net !== null && net !== 0) paidOrWrongMarker = true;
    const markerBlocks = duplicateMarker || invalidMarker || paidOrWrongMarker;
    const isCampaignGift = captureComplete && identity === 'match' && net === 0 && !markerBlocks
      && (markers.length === 0 || markedTrue);
    if (isCampaignGift && quantity) {
      giftIndexes.push(index);
      const next = addSafe(giftQty, quantity);
      if (next === null || next > MAX_QTY) overflow = true;
      else giftQty = next;
    }
    if (qualifying !== null && quantity !== null && !(identity === 'match' && net === 0 && !identityConflict)) {
      const price = moneyToCents(row.price);
      if (price === null) { moneyInvalid = true; qualifying = null; }
      else {
        const line = multiplySafe(price, quantity);
        if (line === null) { overflow = true; qualifying = null; }
        else {
          qualifying = addSafe(qualifying, line);
          if (qualifying === null) overflow = true;
        }
      }
    }
  }

  const choices = choiceEntries(snapshot);
  let duplicateChoice = false;
  let invalidChoice = false;
  let unknownChoice = false;
  let choice: 'keep' | 'decline' | '' = '';
  if (choices.length > 1) duplicateChoice = true;
  else if (choices.length === 1) {
    const parsed = token(choices[0]);
    if (parsed.kind !== 'string' || parsed.text === '') invalidChoice = true;
    else if (parsed.text === 'keep' || parsed.text === 'decline') choice = parsed.text;
    else unknownChoice = true;
  }

  const result = (giftAction: PromotionResolution['giftAction'], reason: PromotionReason, extra: OmsIssue[] = []): PromotionResolution => ({
    ...base, qualifyingCents: qualifying, giftAction, reason, existingGiftIndexes: giftIndexes,
    existingGiftQuantity: giftQty, issues: extra,
  });

  if (overflow) return result('uncertain', 'OVERFLOW', [issue('活動金額或數量超過安全計算範圍')]);
  if (qtyInvalid) return result('uncertain', 'INVALID_QUANTITY', [issue('來源數量無效，無法計算贈品')]);
  if (moneyInvalid || qualifying === null) {
    return result('uncertain', 'INVALID_MONEY', [issue('活動金額格式無效，無法計算贈品')]);
  }
  if (identityConflict) {
    return result('uncertain', 'IDENTITY_CONFLICT', [issue('來源 SKU 與款式身份衝突，不能識別活動贈品')]);
  }
  if (duplicateMarker) return result('uncertain', 'DUPLICATE_MARKER', [issue('活動贈品標記重複，請核對 Shopify')]);
  if (invalidMarker) return result('uncertain', 'INVALID_MARKER', [issue('活動贈品標記空白或無法判定')]);
  if (paidOrWrongMarker) return result('uncertain', 'INVALID_MARKER', [issue('活動贈品標記與商品身份或實付金額矛盾')]);
  if (duplicateChoice) return result('uncertain', 'DUPLICATE_CHOICE', [issue('顧客月餅選擇重複，請核對 Shopify')]);
  if (invalidChoice) return result('uncertain', 'INVALID_CHOICE', [issue('顧客月餅選擇空白或無法判定')]);
  if (unknownChoice) return result('uncertain', 'UNKNOWN_CHOICE', [issue('顧客月餅選擇無法判定')]);
  if (giftQty > 1 || giftIndexes.length > 1) return result('uncertain', 'MULTIPLE_GIFTS', [issue('來源已有超過一顆本活動贈品，請核對後再出貨')]);

  const reached = qualifying >= PROMOTION_THRESHOLD_CENTS;
  const createdRaw = snapshot.order.created_at;
  const calendarOk = hasRealCalendarDate(createdRaw);
  const created = calendarOk ? sourceDate(createdRaw) : null;
  if (looksLikeDatetime(createdRaw) && !calendarOk) {
    return reached
      ? result('uncertain', 'INVALID_DATE', [issue('達門檻但下單日期不是真實日曆日，無法判定活動')])
      : result('ineligible', 'INELIGIBLE_BELOW_THRESHOLD');
  }
  if (!created) {
    return reached
      ? result('uncertain', 'INVALID_DATE', [issue('達門檻但缺少有效下單時間，無法判定活動')])
      : result('ineligible', 'INELIGIBLE_BELOW_THRESHOLD');
  }
  if (created.getTime() < PROMOTION_START_MS) return result('ineligible', 'INELIGIBLE_BEFORE_CAMPAIGN');
  if (!reached) return result('ineligible', 'INELIGIBLE_BELOW_THRESHOLD');
  if (!captureComplete) {
    return result('uncertain', 'MISSING_CAPTURE', [issue('達門檻但來源缺少活動標記，請重新同步來源資料後再審核')]);
  }
  if (choice === 'decline') {
    if (giftQty > 0) return result('uncertain', 'CONTRADICTION', [issue('顧客已拒領，但來源仍有本活動贈品')]);
    return result('declined', 'DECLINED');
  }
  if (giftQty === 1) return result('existing', 'SHOPIFY_EXISTING_GIFT');
  return result('add', 'ADD_HQ_GIFT');
}
