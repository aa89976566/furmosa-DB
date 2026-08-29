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
  oldContainerReturnedAt: string | null;
  productLabel: string | null;
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
  oldContainerReturnedAt?: string | null;
  productLabel?: string | null;
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
    oldContainerReturnedAt: row.oldContainerReturnedAt ?? null,
    productLabel: row.productLabel ?? null,
  };
}

export function customerInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1) : '客';
}

export function formatRefillDateTime(value?: string | Date | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

export function refillListHint(view: RefillStaffView): string {
  if (view.unpaidBlock) return '尚未完成付款';
  if (view.progressLabel === '待帶空罐') return '待客人帶空罐';
  return view.progressLabel;
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

export function refillKindLabel(input: {
  deliveryMode: string;
  orderType?: string;
  productLabel?: string | null;
}): string {
  if (input.productLabel?.trim()) return input.productLabel.trim();
  return input.deliveryMode === 'first' || input.orderType === 'first' ? '首罐' : '換罐';
}

export type RefillPaymentCopyKind = 'unpaid' | 'failed' | 'extra_unpaid' | 'online_paid';

export type RefillPaymentStaffCopy = {
  kind: RefillPaymentCopyKind;
  title: string;
  detail: string;
  staffNeed: string;
};

/** 店員看的付款說明。只依既有 status/paid/amount，不改 collector 或付款結果。 */
export function refillPaymentStaffCopy(input: {
  status: string;
  paid: boolean;
  totalAmount?: number;
  extraAmount?: number;
}): RefillPaymentStaffCopy {
  const amount = Number.isFinite(input.totalAmount) ? Math.trunc(input.totalAmount as number) : null;

  if (input.status === 'payment_failed') {
    return {
      kind: 'failed',
      title: '付款沒有成功',
      detail: '客人這次沒有付成功，現在不能換成新罐。',
      staffNeed: '店員現在不用收款。請客人重新用 LINE 付款，或聯絡匠寵。',
    };
  }

  if (input.status === 'awaiting_extra_payment') {
    return {
      kind: 'extra_unpaid',
      title: '尚未補差額',
      detail: '客人還沒完成補差額，現在不能換成新罐。',
      staffNeed: '店員現在不用代收現金。請客人在線上補差額後再換罐。',
    };
  }

  if (!input.paid || input.status === 'payment_pending') {
    return {
      kind: 'unpaid',
      title: '尚未付款',
      detail: '客人還沒完成線上付款，現在不能換成新罐。',
      staffNeed: '店員現在不用收款。請客人用 LINE 完成付款後再換罐。',
    };
  }

  return {
    kind: 'online_paid',
    title: '匠寵已收款',
    detail:
      amount != null
        ? `換罐費 NT$${amount} 已由客人線上付給匠寵，不列入店家結帳。`
        : '換罐費已由客人線上付給匠寵，不列入店家結帳。',
    staffNeed: '店員現在不用收款，只要幫客人換罐。',
  };
}

export const REFILL_FLOW_STAGES = [
  { id: 'find', label: '找到客人' },
  { id: 'old', label: '確認空罐' },
  { id: 'new', label: '選擇新罐' },
  { id: 'confirm', label: '確認完成' },
] as const;

export type RefillFlowStageId = (typeof REFILL_FLOW_STAGES)[number]['id'];

export type RefillFlowStageState = 'done' | 'current' | 'upcoming';

export function refillFlowStageState(
  stage: RefillFlowStageId,
  current: RefillFlowStageId,
): RefillFlowStageState {
  const order = REFILL_FLOW_STAGES.map((item) => item.id);
  const stageIndex = order.indexOf(stage);
  const currentIndex = order.indexOf(current);
  if (stageIndex < currentIndex) return 'done';
  if (stageIndex === currentIndex) return 'current';
  return 'upcoming';
}

export function refillCurrentFlowStage(input: {
  hasSelection: boolean;
  success: boolean;
  unpaidBlock: boolean;
  skipOldJar: boolean;
  oldVerified: boolean;
  hasNewSerial: boolean;
  newConfirmed: boolean;
}): RefillFlowStageId {
  if (input.success) return 'confirm';
  if (!input.hasSelection || input.unpaidBlock) return 'find';
  if (!input.skipOldJar && !input.oldVerified) return 'old';
  if (!input.hasNewSerial || !input.newConfirmed) return 'new';
  return 'confirm';
}

export function refillCompleteBlockedReason(input: {
  unpaidBlock: boolean;
  oldReady: boolean;
  hasNewSerial: boolean;
  newConfirmed: boolean;
}): string | null {
  if (input.unpaidBlock) return '客人還沒完成付款，現在不能完成換罐。';
  if (!input.oldReady) return '請先確認收到空罐。';
  if (!input.hasNewSerial) return '請先掃描或輸入要交給客人的新罐。';
  if (!input.newConfirmed) return '請先確認這是要交給客人的新罐。';
  return null;
}
