export const MANUAL_POINT_REASON_LABELS = {
  system_test: '系統測試',
  service_recovery: '客服補償',
  missed_credit: '漏登回補',
  correction: '錯誤更正',
} as const;

export type ManualPointReason = keyof typeof MANUAL_POINT_REASON_LABELS;
export type ManualPointMode = 'add' | 'deduct';

export const MANUAL_POINT_MAX_AMOUNT = 1000;
export const MANUAL_POINT_ALLOWED_ROLES = ['admin', 'staff'] as const;

export type ManualPointsInput = {
  customerId: string;
  mode: ManualPointMode;
  amount: number;
  pointsChange: number;
  reason: ManualPointReason;
  reasonLabel: string;
  detail: string;
  requestId: string;
};

export function canAdjustMemberPoints(role: string): boolean {
  return (MANUAL_POINT_ALLOWED_ROLES as readonly string[]).includes(role);
}

export function parseManualPointsInput(values: {
  customerId?: string;
  mode?: string;
  amount?: string;
  reason?: string;
  detail?: string;
  requestId?: string;
}): { ok: true; value: ManualPointsInput } | { ok: false; error: string } {
  const customerId = values.customerId?.trim() ?? '';
  const mode = values.mode?.trim() ?? '';
  const amount = Number(values.amount);
  const reason = values.reason?.trim() ?? '';
  const detail = values.detail?.trim() ?? '';
  const requestId = values.requestId?.trim() ?? '';

  if (!customerId) return { ok: false, error: '缺少會員資料，請返回會員頁後重試' };
  if (mode !== 'add' && mode !== 'deduct') {
    return { ok: false, error: '請選擇增加或扣除點數' };
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > MANUAL_POINT_MAX_AMOUNT) {
    return { ok: false, error: `點數必須是 1～${MANUAL_POINT_MAX_AMOUNT} 的整數` };
  }
  if (!(reason in MANUAL_POINT_REASON_LABELS)) {
    return { ok: false, error: '請選擇調整原因' };
  }
  if (detail.length > 120) return { ok: false, error: '補充說明不可超過 120 字' };
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
    return { ok: false, error: '操作識別碼失效，請重新整理頁面後再試' };
  }

  const typedMode = mode as ManualPointMode;
  const typedReason = reason as ManualPointReason;
  return {
    ok: true,
    value: {
      customerId,
      mode: typedMode,
      amount,
      pointsChange: typedMode === 'add' ? amount : -amount,
      reason: typedReason,
      reasonLabel: MANUAL_POINT_REASON_LABELS[typedReason],
      detail,
      requestId,
    },
  };
}

export function formatManualPointsNote(input: Pick<ManualPointsInput, 'reasonLabel' | 'detail'>) {
  return input.detail ? `${input.reasonLabel}｜${input.detail}` : input.reasonLabel;
}
