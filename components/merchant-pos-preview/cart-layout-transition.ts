import type { MerchantPosSession } from '@/lib/merchant-pos-preview/types';

export function isCheckoutConfirmOpen(session: MerchantPosSession): boolean {
  return session.cartOpen && session.cartDialogStep === 'confirm';
}

export function wouldOpenMobileCartEditor(session: MerchantPosSession): boolean {
  return session.cartOpen && session.cartDialogStep === 'lines';
}

export function applyCheckoutLayoutTransition(
  session: MerchantPosSession,
  fromDesktop: boolean,
  toDesktop: boolean,
): MerchantPosSession {
  if (fromDesktop === toDesktop) return session;
  if (isCheckoutConfirmOpen(session)) return session;
  if (!wouldOpenMobileCartEditor(session)) return session;
  return {
    ...session,
    cartOpen: false,
    cartDialogStep: 'lines',
  };
}

export function cancelCompleteConfirmForLayout(
  session: MerchantPosSession,
  isDesktop: boolean,
): MerchantPosSession {
  if (!isCheckoutConfirmOpen(session)) return session;
  return {
    ...session,
    cartOpen: !isDesktop,
    cartDialogStep: 'lines',
  };
}
