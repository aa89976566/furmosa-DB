import { COPY } from './copy';
import { getPreviewVoucher, PREVIEW_NOW_LABEL, PREVIEW_POS_STORE_ID } from './fixtures';
import type {
  FixtureKey,
  PosBlockReason,
  PosSession,
  PreviewReceipt,
  PreviewVoucher,
} from './types';

export function createPosSession(fixtureKey: FixtureKey = 'available_200'): PosSession {
  return {
    fixtureKey,
    step: 'home',
    codeInput: '',
    lookedUp: false,
    serviceTotalInput: '',
    serviceConfirmed: false,
    submitting: false,
    redeemed: false,
    receipt: null,
    cancelReason: '',
    cancelSubmitted: false,
    blockReason: null,
    liveMessage: '',
  };
}

export function switchFixture(session: PosSession, fixtureKey: FixtureKey): PosSession {
  return {
    ...createPosSession(fixtureKey),
    step: session.step === 'home' ? 'home' : 'lookup',
    liveMessage: `已切換情境：${fixtureKey}`,
  };
}

export function openRedeemTask(session: PosSession): PosSession {
  return {
    ...session,
    step: 'lookup',
    liveMessage: '開始核銷美容券',
  };
}

export function goHome(session: PosSession): PosSession {
  return {
    ...session,
    step: 'home',
    liveMessage: '',
  };
}

export function setCodeInput(session: PosSession, codeInput: string): PosSession {
  return {
    ...session,
    codeInput,
    lookedUp: false,
    blockReason: null,
    liveMessage: '',
  };
}

export function simulateScan(session: PosSession): PosSession {
  const voucher = getPreviewVoucher(session.fixtureKey);
  return lookupVoucher({
    ...session,
    codeInput: voucher.code,
  });
}

export function parseIntegerAmount(
  raw: string,
): { ok: true; value: number } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value <= 0) return { ok: false };
  return { ok: true, value };
}

export function amountExceedsFace(amount: number, faceValue: number): boolean {
  return amount > faceValue;
}

export function liveServiceTotalMessage(raw: string, faceValue: number): string | null {
  if (raw.trim() === '') return null;
  const parsed = parseIntegerAmount(raw);
  if (!parsed.ok) return COPY.invalidAmount;
  if (!amountExceedsFace(parsed.value, faceValue)) return COPY.amountNotGreater(faceValue);
  return null;
}

export function posClerkStep(session: PosSession): 1 | 2 | 3 {
  if (session.step === 'receipt' || session.redeemed) return 3;
  const voucher = getPreviewVoucher(session.fixtureKey);
  if (session.lookedUp && voucher.kind === 'available' && !session.redeemed) return 2;
  return 1;
}

export function messageForBlock(reason: PosBlockReason, faceValue: number): string {
  switch (reason) {
    case 'wrong_store':
      return COPY.wrongStore;
    case 'expired':
      return COPY.expired;
    case 'already_redeemed':
      return COPY.alreadyRedeemed;
    case 'offline':
      return COPY.offline;
    case 'amount_not_greater':
      return COPY.amountNotGreater(faceValue);
    case 'invalid_amount':
      return COPY.invalidAmount;
    case 'service_not_confirmed':
      return COPY.serviceNotConfirmed;
    case 'duplicate_submit':
      return COPY.duplicateSubmit;
    case 'code_required':
      return COPY.codeRequired;
    case 'cancel_reason_required':
      return COPY.cancelReasonRequired;
    default:
      return '';
  }
}

function withBlock(
  session: PosSession,
  reason: PosBlockReason,
  faceValue: number,
): PosSession {
  return {
    ...session,
    blockReason: reason,
    liveMessage: messageForBlock(reason, faceValue),
  };
}

export function lookupVoucher(session: PosSession): PosSession {
  const voucher = getPreviewVoucher(session.fixtureKey);
  if (!session.codeInput.trim()) {
    return withBlock(session, 'code_required', voucher.faceValue);
  }

  const looked: PosSession = {
    ...session,
    lookedUp: true,
    step: 'lookup',
  };

  if (voucher.kind === 'offline') {
    return withBlock(looked, 'offline', voucher.faceValue);
  }
  if (voucher.kind === 'wrong_store' || voucher.boundStoreId !== PREVIEW_POS_STORE_ID) {
    return withBlock(looked, 'wrong_store', voucher.faceValue);
  }
  if (voucher.kind === 'expired') {
    return withBlock(looked, 'expired', voucher.faceValue);
  }
  if (voucher.kind === 'already_redeemed') {
    return withBlock(looked, 'already_redeemed', voucher.faceValue);
  }

  return {
    ...looked,
    blockReason: null,
    liveMessage: `已讀到 ${voucher.memberNicknameMasked} 的券，面額 NT$${voucher.faceValue}`,
  };
}

export function setServiceTotalInput(session: PosSession, serviceTotalInput: string): PosSession {
  return { ...session, serviceTotalInput, blockReason: null };
}

export function setServiceConfirmed(session: PosSession, serviceConfirmed: boolean): PosSession {
  return { ...session, serviceConfirmed, blockReason: null };
}

export function evaluateRedeemGate(
  session: PosSession,
  voucher: PreviewVoucher,
): { ok: true; amount: number } | { ok: false; reason: PosBlockReason } {
  if (session.submitting || session.redeemed) {
    return { ok: false, reason: 'duplicate_submit' };
  }
  if (!session.lookedUp) {
    return { ok: false, reason: 'code_required' };
  }
  if (voucher.kind === 'offline') {
    return { ok: false, reason: 'offline' };
  }
  if (voucher.kind === 'wrong_store') {
    return { ok: false, reason: 'wrong_store' };
  }
  if (voucher.kind === 'expired') {
    return { ok: false, reason: 'expired' };
  }
  if (voucher.kind === 'already_redeemed') {
    return { ok: false, reason: 'already_redeemed' };
  }

  const parsed = parseIntegerAmount(session.serviceTotalInput);
  if (!parsed.ok) {
    return { ok: false, reason: 'invalid_amount' };
  }
  if (!amountExceedsFace(parsed.value, voucher.faceValue)) {
    return { ok: false, reason: 'amount_not_greater' };
  }
  if (!session.serviceConfirmed) {
    return { ok: false, reason: 'service_not_confirmed' };
  }
  return { ok: true, amount: parsed.value };
}

export function openReview(session: PosSession): PosSession {
  const voucher = getPreviewVoucher(session.fixtureKey);
  const gate = evaluateRedeemGate(session, voucher);
  if (!gate.ok) {
    return withBlock(session, gate.reason, voucher.faceValue);
  }
  return {
    ...session,
    step: 'review',
    blockReason: null,
    liveMessage: '請再對一次金額與補貼',
  };
}

export function closeReview(session: PosSession): PosSession {
  if (session.submitting) return session;
  return {
    ...session,
    step: 'lookup',
    liveMessage: '已回到核銷頁',
  };
}

export function startRedeem(session: PosSession): PosSession {
  const voucher = getPreviewVoucher(session.fixtureKey);
  if (session.submitting || session.redeemed) {
    return withBlock(session, 'duplicate_submit', voucher.faceValue);
  }
  const gate = evaluateRedeemGate(session, voucher);
  if (!gate.ok) {
    return withBlock({ ...session, step: 'lookup' }, gate.reason, voucher.faceValue);
  }
  return {
    ...session,
    submitting: true,
    blockReason: null,
    liveMessage: '核銷處理中',
  };
}

export function finishRedeem(session: PosSession): PosSession {
  const voucher = getPreviewVoucher(session.fixtureKey);
  if (session.redeemed) {
    return withBlock(session, 'duplicate_submit', voucher.faceValue);
  }
  if (!session.submitting) {
    return session;
  }
  const parsed = parseIntegerAmount(session.serviceTotalInput);
  if (!parsed.ok) {
    return withBlock({ ...session, submitting: false, step: 'lookup' }, 'invalid_amount', voucher.faceValue);
  }

  const receipt: PreviewReceipt = {
    reference: receiptReferenceFor(session.fixtureKey),
    redeemedAtLabel: PREVIEW_NOW_LABEL,
    storeLabel: voucher.boundStoreLabel,
    subsidyAmount: voucher.faceValue,
    serviceTotal: parsed.value,
    faceValue: voucher.faceValue,
  };

  return {
    ...session,
    submitting: false,
    redeemed: true,
    receipt,
    step: 'receipt',
    blockReason: null,
    liveMessage: `核銷完成，補貼 NT$${voucher.faceValue}`,
  };
}

export function setCancelReason(session: PosSession, cancelReason: string): PosSession {
  return { ...session, cancelReason };
}

export function submitCancelRequest(session: PosSession): PosSession {
  const voucher = getPreviewVoucher(session.fixtureKey);
  if (!session.redeemed || !session.receipt) {
    return session;
  }
  if (session.cancelSubmitted) {
    return {
      ...session,
      liveMessage: COPY.cancelSubmitted,
    };
  }
  if (!session.cancelReason.trim()) {
    return withBlock(session, 'cancel_reason_required', voucher.faceValue);
  }
  return {
    ...session,
    cancelSubmitted: true,
    redeemed: true,
    blockReason: null,
    liveMessage: COPY.cancelSubmitted,
  };
}

export function receiptReferenceFor(fixtureKey: FixtureKey): string {
  const suffix: Record<FixtureKey, string> = {
    available_200: '200A',
    available_250: '250B',
    wrong_store: 'WRNG',
    expired: 'EXP0',
    already_redeemed: 'USED',
    offline: 'OFF0',
  };
  return `GV-RX-PREVIEW-${suffix[fixtureKey]}`;
}

export function currentVoucher(session: PosSession): PreviewVoucher {
  return getPreviewVoucher(session.fixtureKey);
}

export function canShowVoucherFacts(session: PosSession): boolean {
  return session.lookedUp;
}

export function isOfflineNoQueue(session: PosSession): boolean {
  return session.lookedUp && getPreviewVoucher(session.fixtureKey).kind === 'offline';
}
