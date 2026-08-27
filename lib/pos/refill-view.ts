/** POS 換罐畫面用的狀態與查詢整理。不改後端訂單狀態機。 */

export type RefillLookupKind = 'serial' | 'id' | 'display' | 'unknown';

export type ParsedRefillLookup =
  | { kind: 'serial'; value: string }
  | { kind: 'id'; value: string }
  | { kind: 'display'; value: string; yymmdd: string; suffix: string }
  | { kind: 'unknown'; value: string };

export type PosRefillOrderCard = {
  id: string;
  status: string;
  orderType: string;
  deliveryMode: string;
  totalAmount: number;
  extraAmount: number;
  customerName: string;
  petName: string | null;
  createdAt: string;
  paid: boolean;
  oldContainerSerial: string | null;
  newContainerSerial: string | null;
  missingContainerNote: string | null;
};

export type RefillViewInput = {
  id: string;
  status: string;
  paid: boolean;
  deliveryMode: string;
  orderType?: string;
  extraAmount?: number;
  missingContainerNote?: string | null;
  createdAt?: string | Date;
};

export type RefillStaffView = {
  orderNo: string;
  paymentLabel: '已付款' | '尚未付款' | '已補差額';
  progressLabel: '待帶空罐' | '等待交付' | '換罐完成' | '尚未付款';
  canFulfill: boolean;
  skipOldJar: boolean;
  unpaidBlock: boolean;
  extraPaid: boolean;
};

export function toPosRefillOrderCard(row: {
  id: string;
  status: string;
  orderType: string;
  deliveryMode: string;
  totalAmount: number;
  extraAmount?: number;
  customerName: string;
  petName: string | null;
  createdAt: string;
  paid: boolean;
  oldContainerSerial: string | null;
  newContainerSerial: string | null;
  missingContainerNote: string | null;
}): PosRefillOrderCard {
  return {
    id: row.id,
    status: row.status,
    orderType: row.orderType,
    deliveryMode: row.deliveryMode,
    totalAmount: row.totalAmount,
    extraAmount: row.extraAmount ?? 0,
    customerName: row.customerName,
    petName: row.petName,
    createdAt: row.createdAt,
    paid: row.paid,
    oldContainerSerial: row.oldContainerSerial,
    newContainerSerial: row.newContainerSerial,
    missingContainerNote: row.missingContainerNote,
  };
}

export function formatRefillOrderNo(id: string, createdAt?: string | Date | null): string {
  const date = createdAt ? new Date(createdAt) : null;
  const valid = date && !Number.isNaN(date.getTime());
  const y = valid ? String(date.getFullYear()).slice(2) : '00';
  const m = valid ? String(date.getMonth() + 1).padStart(2, '0') : '00';
  const d = valid ? String(date.getDate()).padStart(2, '0') : '00';
  const suffix = id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '0000';
  return `#RFP-${y}${m}${d}-${suffix}`;
}

export function normalizeRefillLookupInput(raw: string): string {
  return raw
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/[–—−﹣]/g, '-')
    .trim();
}

export function parseRefillLookupQuery(raw: string): ParsedRefillLookup {
  const value = normalizeRefillLookupInput(raw);
  if (!value) return { kind: 'unknown', value };

  const digits = value.replace(/\D/g, '');
  if (/^\d{8}$/.test(digits)) {
    return { kind: 'serial', value: digits };
  }

  const display = value.toUpperCase().replace(/^#/, '');
  const displayMatch = /^RFP-(\d{6})-([A-Z0-9]{4})$/.exec(display);
  if (displayMatch) {
    return {
      kind: 'display',
      value: `#${display}`,
      yymmdd: displayMatch[1],
      suffix: displayMatch[2],
    };
  }

  if (/^[a-z0-9]{20,}$/i.test(value)) {
    return { kind: 'id', value };
  }

  return { kind: 'unknown', value };
}

export function refillStaffView(input: RefillViewInput): RefillStaffView {
  const skipOldJar =
    input.deliveryMode === 'first' || input.orderType === 'first';
  const extraPaid =
    skipOldJar &&
    (input.extraAmount ?? 0) > 0 &&
    Boolean(input.paid) &&
    input.status !== 'payment_pending' &&
    input.status !== 'awaiting_extra_payment';
  const unpaidBlock =
    !input.paid ||
    input.status === 'payment_pending' ||
    input.status === 'awaiting_extra_payment';
  const canFulfill =
    !unpaidBlock &&
    (input.status === 'paid_waiting_return' || input.status === 'old_container_verified');

  let paymentLabel: RefillStaffView['paymentLabel'] = '尚未付款';
  if (extraPaid) paymentLabel = '已補差額';
  else if (!unpaidBlock) paymentLabel = '已付款';

  let progressLabel: RefillStaffView['progressLabel'] = '尚未付款';
  if (input.status === 'completed') progressLabel = '換罐完成';
  else if (unpaidBlock) progressLabel = '尚未付款';
  else if (input.status === 'old_container_verified' || skipOldJar) progressLabel = '等待交付';
  else progressLabel = '待帶空罐';

  return {
    orderNo: formatRefillOrderNo(input.id, input.createdAt),
    paymentLabel,
    progressLabel,
    canFulfill,
    skipOldJar,
    unpaidBlock,
    extraPaid,
  };
}

export function isProcessableRefillStatus(status: string, paid: boolean): boolean {
  return refillStaffView({
    id: 'x',
    status,
    paid,
    deliveryMode: 'exchange',
  }).canFulfill;
}
