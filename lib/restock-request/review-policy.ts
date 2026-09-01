import {
  RESTOCK_APPROVABLE_STATUSES,
  RESTOCK_FINAL_STATUSES,
  RESTOCK_HQ_EDITABLE_STATUSES,
  RESTOCK_REJECTABLE_STATUSES,
  type RestockRequestStatus,
} from '@/lib/restock-request/constants';
import { canTransitionRestockRequest } from '@/lib/pos/domain-contract';

export const RESTOCK_REVIEW_CONFLICT_MESSAGE = '這張申請已被其他人更新，請重新載入';

export class RestockRequestConflictError extends Error {
  constructor(message = RESTOCK_REVIEW_CONFLICT_MESSAGE) {
    super(message);
    this.name = 'RestockRequestConflictError';
  }
}

export class RestockRequestReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestockRequestReviewError';
  }
}

export type HqReviewAction = 'save' | 'approve' | 'reject';

export type HqApprovedQtyPayload = {
  productId: string;
  approvedQuantity: unknown;
};

export type HqServerItem = {
  productId: string;
  requestedQuantity: number | null;
};

export type HqApprovedLine = {
  productId: string;
  requestedQuantity: number | null;
  approvedQuantity: number;
};

export function isRestockFinalStatus(
  status: string,
  shipmentId?: string | null,
): boolean {
  if (shipmentId) return true;
  return (RESTOCK_FINAL_STATUSES as readonly string[]).includes(status);
}

export function canShowHqRestockReviewForm(
  status: string,
  shipmentId?: string | null,
): boolean {
  if (isRestockFinalStatus(status, shipmentId)) return false;
  if (status === 'draft') return false;
  return (
    (RESTOCK_HQ_EDITABLE_STATUSES as readonly string[]).includes(status) ||
    (RESTOCK_APPROVABLE_STATUSES as readonly string[]).includes(status)
  );
}

export function hqReviewAllowedStatuses(action: HqReviewAction): readonly RestockRequestStatus[] {
  if (action === 'reject') return RESTOCK_REJECTABLE_STATUSES;
  if (action === 'approve') return RESTOCK_APPROVABLE_STATUSES;
  return RESTOCK_HQ_EDITABLE_STATUSES;
}

export function assertHqReviewTransition(input: {
  action: HqReviewAction;
  currentStatus: string;
  shipmentId?: string | null;
}): void {
  if (input.shipmentId || input.currentStatus === 'converted_to_shipment') {
    throw new RestockRequestConflictError();
  }
  if (input.currentStatus === 'rejected' || input.currentStatus === 'cancelled') {
    throw new RestockRequestConflictError();
  }
  if (input.currentStatus === 'draft') {
    throw new RestockRequestReviewError('草稿尚未送出，不能審核');
  }
  const allowed = hqReviewAllowedStatuses(input.action);
  if (!(allowed as readonly string[]).includes(input.currentStatus)) {
    throw new RestockRequestConflictError(RESTOCK_REVIEW_CONFLICT_MESSAGE);
  }
}

/** 核准並轉單是既有快捷流程：submitted / under_review / approved 均可。 */
export function isExistingApproveConvertShortcut(from: string): boolean {
  return (RESTOCK_APPROVABLE_STATUSES as readonly string[]).includes(from);
}

export function domainAllowsReject(from: string): boolean {
  return canTransitionRestockRequest(from, 'rejected');
}

export function parseHqApprovedQuantity(
  raw: unknown,
): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) return { ok: false, error: '核准數量必須是整數' };
    if (raw < 0) return { ok: false, error: '核准數量不可為負' };
    return { ok: true, value: raw };
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^-?\d+$/.test(trimmed)) return { ok: false, error: '核准數量必須是整數' };
    const value = Number(trimmed);
    if (!Number.isInteger(value)) return { ok: false, error: '核准數量必須是整數' };
    if (value < 0) return { ok: false, error: '核准數量不可為負' };
    return { ok: true, value };
  }
  return { ok: false, error: '核准數量必須是整數' };
}

export function buildHqItemApprovals(input: {
  existingItems: HqServerItem[];
  payload: HqApprovedQtyPayload[];
}): { ok: true; lines: HqApprovedLine[] } | { ok: false; error: string } {
  const productIds = input.payload.map((row) => row.productId.trim()).filter(Boolean);
  if (productIds.length !== input.payload.length) {
    return { ok: false, error: '品項資料不完整' };
  }
  if (new Set(productIds).size !== productIds.length) {
    return { ok: false, error: '同一品項不能重複送出' };
  }

  const existingById = new Map(input.existingItems.map((item) => [item.productId, item]));
  const allowCatalogAdds = input.existingItems.length === 0;

  if (!allowCatalogAdds) {
    for (const productId of productIds) {
      if (!existingById.has(productId)) {
        return { ok: false, error: '只能審核這張申請上的品項' };
      }
    }
    for (const item of input.existingItems) {
      if (!productIds.includes(item.productId)) {
        return { ok: false, error: '申請品項不完整，請重新載入後再送出' };
      }
    }
  }

  const lines: HqApprovedLine[] = [];
  for (const row of input.payload) {
    const parsed = parseHqApprovedQuantity(row.approvedQuantity);
    if (!parsed.ok) return parsed;
    const existing = existingById.get(row.productId);
    const requestedQuantity = existing?.requestedQuantity ?? null;
    if (requestedQuantity != null && parsed.value > requestedQuantity) {
      return { ok: false, error: '核准數量不能超過店家申請數量' };
    }
    lines.push({
      productId: row.productId,
      requestedQuantity,
      approvedQuantity: parsed.value,
    });
  }
  return { ok: true, lines };
}

export function assertApproveHasPositiveQty(lines: HqApprovedLine[]): void {
  if (!lines.some((line) => line.approvedQuantity > 0)) {
    throw new RestockRequestReviewError('至少需要一個核准數量大於 0 的品項');
  }
}

export function parseHqRejectNote(raw: unknown): string {
  const note = String(raw ?? '').trim();
  if (!note) {
    throw new RestockRequestReviewError('請填寫拒絕原因');
  }
  return note;
}

/** Client 可提交的欄位。其餘（status、merchantId、approvedBy）一律忽略。 */
export function readHqReviewFormFields(formData: FormData): {
  requestId: string;
  hqNote: string;
  expectedArrivalDateRaw: string;
  items: HqApprovedQtyPayload[];
} {
  const requestId = String(formData.get('requestId') ?? '').trim();
  const hqNote = String(formData.get('hqNote') ?? '');
  const expectedArrivalDateRaw = String(formData.get('expectedArrivalDate') ?? '').trim();
  const productIds = formData.getAll('productId').map(String);
  const approvedQtys = formData.getAll('approvedQuantity');
  const items = productIds.map((productId, index) => ({
    productId,
    approvedQuantity: approvedQtys[index],
  }));
  return { requestId, hqNote, expectedArrivalDateRaw, items };
}

export function hqReviewClaimCountIsConflict(count: number): boolean {
  return count !== 1;
}

export function hqReviewClaimWhere(action: HqReviewAction): {
  shipmentId: null;
  status: { in: RestockRequestStatus[] };
} {
  return {
    shipmentId: null,
    status: { in: [...hqReviewAllowedStatuses(action)] },
  };
}

export function hqRestockDetailViewMode(
  status: string,
  shipmentId?: string | null,
): 'review' | 'convert' | 'result' {
  if (isRestockFinalStatus(status, shipmentId) || status === 'draft') {
    return 'result';
  }
  if (status === 'approved') return 'convert';
  if ((RESTOCK_HQ_EDITABLE_STATUSES as readonly string[]).includes(status)) {
    return 'review';
  }
  return 'result';
}

export function canEditHqRestockItems(
  status: string,
  shipmentId?: string | null,
): boolean {
  return hqRestockDetailViewMode(status, shipmentId) === 'review';
}

export function canAddHqRestockCatalogItems(
  status: string,
  existingItemCount: number,
  shipmentId?: string | null,
): boolean {
  return canEditHqRestockItems(status, shipmentId) && existingItemCount === 0;
}

export function requireHqReviewActor(user: { userId: string } | null | undefined): string {
  const userId = user?.userId?.trim();
  if (!userId) {
    throw new RestockRequestReviewError('請先登入總部帳號');
  }
  return userId;
}

export function parseHqExpectedArrivalDate(
  raw: unknown,
  required: boolean,
): Date | null {
  const text = String(raw ?? '').trim();
  if (!text) {
    if (required) {
      throw new RestockRequestReviewError('請填寫預計到貨日');
    }
    return null;
  }
  const value = new Date(text);
  if (Number.isNaN(value.getTime())) {
    throw new RestockRequestReviewError('預計到貨日格式不正確');
  }
  return value;
}

export function hqReviewActionStateFromError(error: unknown): {
  error: string;
  conflict?: boolean;
} {
  if (error instanceof RestockRequestConflictError) {
    return { error: error.message, conflict: true };
  }
  if (error instanceof RestockRequestReviewError) {
    return { error: error.message };
  }
  if (error instanceof Error) {
    const conflictLike =
      error.message.includes('已被其他人更新') ||
      error.message.includes('無法再審核') ||
      error.message.includes('無法拒絕') ||
      error.message.includes('無法再修改') ||
      error.message.includes('已結束');
    if (conflictLike) {
      return { error: RESTOCK_REVIEW_CONFLICT_MESSAGE, conflict: true };
    }
    return { error: error.message };
  }
  return { error: '操作失敗' };
}

export function shouldApplyHqItemPayload(status: string): boolean {
  return (RESTOCK_HQ_EDITABLE_STATUSES as readonly string[]).includes(status);
}

export function hqRestockAllowedActionLabels(
  status: string,
  shipmentId?: string | null,
): string[] {
  const mode = hqRestockDetailViewMode(status, shipmentId);
  if (mode === 'review') return ['儲存核准數量', '確認核准申請', '拒絕申請'];
  if (mode === 'convert') return ['確認核准申請'];
  return [];
}
