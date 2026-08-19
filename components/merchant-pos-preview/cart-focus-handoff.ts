import { canRestoreDialogTrigger } from '@/lib/merchant-pos-preview/a11y';

export const DESKTOP_CART_TITLE_ID = 'preview-desktop-cart-title';

export type CheckoutFocusIntent =
  | 'none'
  | 'desktop-cart-region'
  | 'mobile-open-cart-cta'
  | 'checkout-heading';

export type CheckoutFocusHandoffInput = {
  fromDesktop: boolean;
  toDesktop: boolean;
  editorLinesOpen: boolean;
  confirmOpen: boolean;
  cartItemCount: number;
  desktopCartHadFocus: boolean;
  reason: 'layout-change' | 'desktop-confirm-cancel' | 'mobile-confirm-cancel';
};

export type FocusableNode = {
  isConnected?: boolean;
  focus?: () => void;
} | null;

export type CheckoutFocusNodes = {
  'desktop-cart-region': FocusableNode;
  'mobile-open-cart-cta': FocusableNode;
  'checkout-heading': FocusableNode;
};

const FALLBACK: Record<Exclude<CheckoutFocusIntent, 'none'>, CheckoutFocusIntent[]> = {
  'desktop-cart-region': ['checkout-heading'],
  'mobile-open-cart-cta': ['checkout-heading'],
  'checkout-heading': [],
};

export function nextCheckoutFocusIntent(input: CheckoutFocusHandoffInput): CheckoutFocusIntent {
  if (input.reason === 'desktop-confirm-cancel') return 'desktop-cart-region';
  if (input.reason === 'mobile-confirm-cancel') return 'none';
  if (input.fromDesktop === input.toDesktop) return 'none';
  if (input.confirmOpen) return 'none';
  if (!input.fromDesktop && input.toDesktop && input.editorLinesOpen) {
    return 'desktop-cart-region';
  }
  if (input.fromDesktop && !input.toDesktop && input.desktopCartHadFocus) {
    return input.cartItemCount > 0 ? 'mobile-open-cart-cta' : 'checkout-heading';
  }
  return 'none';
}

export function resolveConnectedFocusIntent(
  intent: CheckoutFocusIntent,
  nodes: CheckoutFocusNodes,
): CheckoutFocusIntent {
  if (intent === 'none') return 'none';
  const candidates = [intent, ...FALLBACK[intent]];
  for (const candidate of candidates) {
    if (candidate !== 'none' && canRestoreDialogTrigger(nodes[candidate])) {
      return candidate;
    }
  }
  return 'none';
}

export function applyCheckoutFocusHandoff(
  intent: CheckoutFocusIntent,
  nodes: CheckoutFocusNodes,
): CheckoutFocusIntent {
  const resolved = resolveConnectedFocusIntent(intent, nodes);
  if (resolved === 'none') return 'none';
  nodes[resolved]?.focus?.();
  return resolved;
}

export type DesktopCartFocusCaptureEvent =
  | { type: 'focus-inside' }
  | { type: 'blur'; relatedTargetInside: boolean | null };

export function nextDesktopCartFocusCapture(
  hadFocus: boolean,
  event: DesktopCartFocusCaptureEvent,
): boolean {
  if (event.type === 'focus-inside') return true;
  if (event.relatedTargetInside == null) return hadFocus;
  return event.relatedTargetInside;
}

export function consumeDesktopCartHadFocus(hadFocus: boolean): {
  desktopCartHadFocus: boolean;
  nextHadFocus: false;
} {
  return { desktopCartHadFocus: hadFocus, nextHadFocus: false };
}

export function isRelatedTargetInsideRegion(
  region: { contains?: (node: never) => boolean } | null,
  relatedTarget: EventTarget | null,
): boolean | null {
  if (relatedTarget == null) return null;
  if (region == null || typeof region.contains !== 'function') return false;
  return Boolean(region.contains(relatedTarget as never));
}
