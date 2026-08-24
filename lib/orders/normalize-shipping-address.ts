/** 舊 customer order 配送字串解析。測試與 log 只用假資料，不輸出真實 PII。 */

export const SHIPPING_NORMALIZE_MARKER = '[shipping_normalize:v1]';

export const CUSTOMER_ORDER_SOURCES = ['shopify', 'website', 'line', 'manual'] as const;

export type NormalizeSkipReason =
  | 'empty'
  | 'no_embedded_fields'
  | 'multiple_phones'
  | 'store_brand_without_id_or_name'
  | 'conflicting_existing_values'
  | 'already_normalized'
  | 'not_customer_order'
  | 'ambiguous_blob';

export type ParsedShippingFields = {
  recipientName?: string;
  recipientPhone?: string;
  cvsBrand?: '711';
  cvsStoreId?: string;
  cvsStoreName?: string;
  leftoverAddress?: string;
};

export type ParseShippingOk = {
  ok: true;
  fields: ParsedShippingFields;
  extracted: Array<keyof ParsedShippingFields>;
};

export type ParseShippingSkip = {
  ok: false;
  reason: NormalizeSkipReason;
};

export type ParseShippingResult = ParseShippingOk | ParseShippingSkip;

const PHONE_RE = /09\d{2}[-\s]?\d{3}[-\s]?\d{3}/g;
const RECIPIENT_RE = /(?:收件人|姓名)\s*[:：]\s*([^\n,，/／|]{2,20})/;
const STORE_BRAND_RE = /7\s*-?\s*ELEVEN|7\s*-?\s*11|統一超商|(?<![A-Za-z0-9])711(?![A-Za-z0-9])/i;
const STORE_ID_RE = /(?:店號|門市店號|門市編號)\s*[:：#]?\s*(\d{6})/;
const STORE_ID_PARENS_RE = /[（(]\s*(\d{6})\s*[）)]/;
const STORE_NAME_RE =
  /(?:7\s*-?\s*ELEVEN|7\s*-?\s*11|統一超商|711)\s*[:：]?\s*([^\n,，/|0-9]+?門市)/i;

function compactPhone(value: string): string {
  return value.replace(/\D/g, '');
}

function cleanName(value: string): string | undefined {
  const name = value.replace(/[的的電話手機].*$/, '').replace(/[：:\s]+$/g, '').trim();
  if (name.length < 2 || name.length > 20) return undefined;
  if (/\d/.test(name)) return undefined;
  if (STORE_BRAND_RE.test(name)) return undefined;
  return name;
}

function hasStoreBrand(text: string): boolean {
  return STORE_BRAND_RE.test(text);
}

export function parseEmbeddedShippingAddress(
  raw: string | null | undefined,
): ParseShippingResult {
  const text = (raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return { ok: false, reason: 'empty' };

  const phoneMatches = text.match(PHONE_RE) ?? [];
  const uniquePhones = [...new Set(phoneMatches.map(compactPhone).filter((p) => p.length === 10))];
  if (uniquePhones.length > 1) {
    return { ok: false, reason: 'multiple_phones' };
  }

  const recipientName = cleanName(RECIPIENT_RE.exec(text)?.[1] ?? '');
  const recipientPhone = uniquePhones[0];

  const branded = hasStoreBrand(text);
  const storeId =
    STORE_ID_RE.exec(text)?.[1] ?? (branded ? STORE_ID_PARENS_RE.exec(text)?.[1] : undefined);
  const storeName = branded
    ? STORE_NAME_RE.exec(text)?.[1]?.replace(/\s+/g, '').trim() || undefined
    : undefined;

  if (branded && !storeId && !storeName) {
    return { ok: false, reason: 'store_brand_without_id_or_name' };
  }

  const fields: ParsedShippingFields = {};
  const extracted: Array<keyof ParsedShippingFields> = [];
  if (recipientName) {
    fields.recipientName = recipientName;
    extracted.push('recipientName');
  }
  if (recipientPhone) {
    fields.recipientPhone = recipientPhone;
    extracted.push('recipientPhone');
  }
  if (storeId || storeName) {
    fields.cvsBrand = '711';
    extracted.push('cvsBrand');
    if (storeId) {
      fields.cvsStoreId = storeId;
      extracted.push('cvsStoreId');
    }
    if (storeName) {
      fields.cvsStoreName = storeName;
      extracted.push('cvsStoreName');
    }
  }

  if (extracted.length === 0) {
    return { ok: false, reason: 'no_embedded_fields' };
  }

  const leftover = leftoverAfterExtract(text, fields);
  if (leftover) {
    fields.leftoverAddress = leftover;
    extracted.push('leftoverAddress');
  }

  return { ok: true, fields, extracted };
}

function leftoverAfterExtract(text: string, fields: ParsedShippingFields): string | undefined {
  let leftover = text;
  leftover = leftover.replace(RECIPIENT_RE, ' ');
  leftover = leftover.replace(PHONE_RE, ' ');
  leftover = leftover.replace(STORE_ID_RE, ' ');
  leftover = leftover.replace(STORE_ID_PARENS_RE, ' ');
  leftover = leftover.replace(STORE_NAME_RE, ' ');
  leftover = leftover.replace(STORE_BRAND_RE, ' ');
  leftover = leftover
    .replace(/收件人|姓名|手機|電話|店號|門市店號|門市編號/g, ' ')
    .replace(/[:：#]/g, ' ')
    .replace(/[|/／、,，;；]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!leftover) return undefined;
  if (fields.recipientName && leftover === fields.recipientName) return undefined;
  if (fields.cvsStoreName && leftover.replace(/\s+/g, '') === fields.cvsStoreName) return undefined;
  return leftover;
}

export type RepairShipmentSnapshot = {
  id: string;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
};

export type CustomerShippingRepairInput = {
  source: string;
  note: string | null;
  shippingAddress: string | null;
  shippingMethod: string;
  cvsBrand: string | null;
  cvsStoreId: string | null;
  cvsStoreName: string | null;
  shipments: RepairShipmentSnapshot[];
};

export type CustomerShippingOrderPatch = {
  shippingAddress?: string | null;
  shippingMethod?: string;
  cvsBrand?: string;
  cvsStoreId?: string;
  cvsStoreName?: string;
  note?: string;
};

export type CustomerShippingShipmentPatch = {
  shipmentId: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
};

export type CustomerShippingRepairPlan =
  | { action: 'skip'; reason: NormalizeSkipReason }
  | { action: 'noop'; reason: 'already_structured' | 'already_normalized' }
  | {
      action: 'repair';
      orderPatch: CustomerShippingOrderPatch;
      shipmentPatches: CustomerShippingShipmentPatch[];
      extracted: string[];
    };

function conflicts(
  current: string | null | undefined,
  next: string | undefined,
): boolean {
  if (!current?.trim() || !next) return false;
  return current.trim() !== next;
}

export function planCustomerShippingRepair(
  input: CustomerShippingRepairInput,
): CustomerShippingRepairPlan {
  if (
    !(CUSTOMER_ORDER_SOURCES as readonly string[]).includes(input.source)
  ) {
    return { action: 'skip', reason: 'not_customer_order' };
  }
  if ((input.note ?? '').includes(SHIPPING_NORMALIZE_MARKER)) {
    return { action: 'noop', reason: 'already_normalized' };
  }

  const parsed = parseEmbeddedShippingAddress(input.shippingAddress);
  if (!parsed.ok) return { action: 'skip', reason: parsed.reason };

  const { fields } = parsed;
  if (
    conflicts(input.cvsStoreId, fields.cvsStoreId) ||
    conflicts(input.cvsStoreName, fields.cvsStoreName) ||
    conflicts(input.cvsBrand, fields.cvsBrand)
  ) {
    return { action: 'skip', reason: 'conflicting_existing_values' };
  }

  const orderPatch: CustomerShippingOrderPatch = {};
  const extracted: string[] = [];

  if (fields.cvsBrand && !input.cvsBrand?.trim()) {
    orderPatch.cvsBrand = fields.cvsBrand;
    extracted.push('cvsBrand');
  }
  if (fields.cvsStoreId && !input.cvsStoreId?.trim()) {
    orderPatch.cvsStoreId = fields.cvsStoreId;
    extracted.push('cvsStoreId');
  }
  if (fields.cvsStoreName && !input.cvsStoreName?.trim()) {
    orderPatch.cvsStoreName = fields.cvsStoreName;
    extracted.push('cvsStoreName');
  }
  if ((fields.cvsStoreId || fields.cvsStoreName) && input.shippingMethod !== 'convenience') {
    orderPatch.shippingMethod = 'convenience';
    extracted.push('shippingMethod');
  }
  if (fields.leftoverAddress && fields.leftoverAddress !== input.shippingAddress) {
    orderPatch.shippingAddress = fields.leftoverAddress;
    extracted.push('shippingAddress');
  }

  const shipmentPatches: CustomerShippingShipmentPatch[] = [];
  for (const shipment of input.shipments) {
    const patch: CustomerShippingShipmentPatch = { shipmentId: shipment.id };
    if (fields.recipientName && !shipment.recipientName?.trim()) {
      patch.recipientName = fields.recipientName;
    }
    if (fields.recipientPhone && !shipment.recipientPhone?.trim()) {
      patch.recipientPhone = fields.recipientPhone;
    }
    if (
      (fields.leftoverAddress || fields.cvsStoreName) &&
      !shipment.recipientAddress?.trim()
    ) {
      patch.recipientAddress = fields.leftoverAddress ?? fields.cvsStoreName;
    }
    if (patch.recipientName || patch.recipientPhone || patch.recipientAddress) {
      if (patch.recipientName) extracted.push('recipientName');
      if (patch.recipientPhone) extracted.push('recipientPhone');
      if (patch.recipientAddress) extracted.push('recipientAddress');
      shipmentPatches.push(patch);
    }
  }

  const hasOrderChange = Object.keys(orderPatch).some((key) => key !== 'note');
  if (!hasOrderChange && shipmentPatches.length === 0) {
    return { action: 'noop', reason: 'already_structured' };
  }

  const extractedUnique = [...new Set(extracted)];
  orderPatch.note = appendNormalizeAudit(input.note, extractedUnique, input.shippingAddress);
  return {
    action: 'repair',
    orderPatch,
    shipmentPatches,
    extracted: extractedUnique,
  };
}

export function appendNormalizeAudit(
  note: string | null,
  extracted: string[],
  originalShippingAddress: string | null,
): string {
  const backup = [
    SHIPPING_NORMALIZE_MARKER,
    `extracted=${extracted.join(',') || 'none'}`,
    'originalShippingAddress:',
    originalShippingAddress ?? '',
  ].join('\n');
  return note?.trim() ? `${note.trim()}\n${backup}` : backup;
}
