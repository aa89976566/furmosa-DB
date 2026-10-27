export const VENDOR_SETTLEMENT_STATUSES = [
  'draft',
  'reviewing',
  'approved',
  'paid',
] as const;

export type VendorSettlementStatus = (typeof VENDOR_SETTLEMENT_STATUSES)[number];

const transitions: Record<VendorSettlementStatus, VendorSettlementStatus[]> = {
  draft: ['reviewing'],
  reviewing: ['draft', 'approved'],
  approved: ['reviewing', 'paid'],
  paid: [],
};

export function assertVendorSettlementTransition(input: {
  current: string;
  next: string;
  actorRole: string;
}) {
  if (!VENDOR_SETTLEMENT_STATUSES.includes(input.current as VendorSettlementStatus)) {
    throw new Error('目前對帳狀態無法辨識');
  }
  if (!VENDOR_SETTLEMENT_STATUSES.includes(input.next as VendorSettlementStatus)) {
    throw new Error('目標對帳狀態無法辨識');
  }
  const current = input.current as VendorSettlementStatus;
  const next = input.next as VendorSettlementStatus;
  if (!transitions[current].includes(next)) throw new Error('不允許這個對帳狀態變更');
  if (!['admin', 'staff'].includes(input.actorRole)) throw new Error('沒有供應商對帳操作權限');
  if (['approved', 'paid'].includes(next) && input.actorRole !== 'admin') {
    throw new Error('只有管理員可以確認或標記供應商款項已支付');
  }
  return { current, next };
}

export function vendorSettlementNextActions(status: string, actorRole: string) {
  if (!VENDOR_SETTLEMENT_STATUSES.includes(status as VendorSettlementStatus)) return [];
  return transitions[status as VendorSettlementStatus].filter((next) => {
    if (['approved', 'paid'].includes(next)) return actorRole === 'admin';
    return ['admin', 'staff'].includes(actorRole);
  });
}

export function vendorSettlementPaymentReference(next: string, value: string) {
  if (next !== 'paid') return null;
  const reference = value.trim();
  if (reference.length < 3) throw new Error('標記已付款前，請填寫付款憑證或轉帳末五碼');
  if (reference.length > 200) throw new Error('付款註記不可超過 200 字');
  return reference;
}
