import { COPY } from './copy';
import { HQ_CANCEL_REQUESTS, PREVIEW_NOW_LABEL, PREVIEW_POINTS_RETURN } from './fixtures';
import type { HqCancelRequest, HqCancelTab } from './types';

export function cloneHqRequests(source = HQ_CANCEL_REQUESTS): HqCancelRequest[] {
  return source.map((row) => ({
    ...row,
    timeline: row.timeline.map((event) => ({ ...event })),
  }));
}

export function requestsForTab(
  requests: HqCancelRequest[],
  tab: HqCancelTab,
): HqCancelRequest[] {
  return requests.filter((row) => row.tab === tab);
}

export function findRequest(
  requests: HqCancelRequest[],
  id: string,
): HqCancelRequest | undefined {
  return requests.find((row) => row.id === id);
}

export function lockedPeriodCopy(request: HqCancelRequest): string | null {
  if (!request.periodLocked) return null;
  return COPY.lockedPeriod;
}

export function approveConfirmCopy(request: HqCancelRequest): string {
  return COPY.approveConfirm(request.subsidyAmount);
}

export function canApprove(request: HqCancelRequest): boolean {
  return request.tab === 'pending';
}

export function canReject(request: HqCancelRequest): boolean {
  return request.tab === 'pending';
}

export function approveRequest(
  requests: HqCancelRequest[],
  id: string,
): { ok: true; requests: HqCancelRequest[] } | { ok: false; error: string } {
  const current = findRequest(requests, id);
  if (!current) return { ok: false, error: '找不到這筆申請。' };
  if (!canApprove(current)) return { ok: false, error: '這筆已經審過了。' };

  const next: HqCancelRequest = {
    ...current,
    tab: 'approved',
    timeline: [
      ...current.timeline,
      {
        atLabel: PREVIEW_NOW_LABEL,
        title: 'HQ 核准',
        detail: [
          `退回 ${PREVIEW_POINTS_RETURN} 點`,
          `沖銷 NT$${current.subsidyAmount}`,
          '原券永久作廢',
          current.periodLocked ? COPY.lockedPeriod : null,
        ]
          .filter(Boolean)
          .join('、'),
      },
    ],
  };

  return {
    ok: true,
    requests: requests.map((row) => (row.id === id ? next : row)),
  };
}

export function rejectRequest(
  requests: HqCancelRequest[],
  id: string,
  note: string,
): { ok: true; requests: HqCancelRequest[] } | { ok: false; error: string } {
  const current = findRequest(requests, id);
  if (!current) return { ok: false, error: '找不到這筆申請。' };
  if (!canReject(current)) return { ok: false, error: '這筆已經審過了。' };
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, error: COPY.rejectNoteRequired };

  const next: HqCancelRequest = {
    ...current,
    tab: 'rejected',
    rejectNote: trimmed,
    timeline: [
      ...current.timeline,
      {
        atLabel: PREVIEW_NOW_LABEL,
        title: 'HQ 拒絕',
        detail: trimmed,
      },
    ],
  };

  return {
    ok: true,
    requests: requests.map((row) => (row.id === id ? next : row)),
  };
}

export function voucherStaysVoidAfterApprove(request: HqCancelRequest): boolean {
  return request.tab === 'approved';
}
