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

export type DesktopCartFocusCaptureState = {
  hadFocus: boolean;
  pendingNullBlurToken: number | null;
};

export type DesktopCartFocusCaptureEvent =
  | { type: 'focus-inside' }
  | { type: 'related-blur'; relatedTargetInside: boolean }
  | { type: 'null-blur'; token: number }
  | {
      type: 'resolve-null-blur';
      token: number;
      regionConnected: boolean;
      sameRegion: boolean;
      activeElementInside: boolean;
    }
  | { type: 'leave-checkout' };

export type NullBlurRegionSnapshot = {
  regionConnected: boolean;
  sameRegion: boolean;
  activeElementInside: boolean;
};

export function createDesktopCartFocusCaptureState(): DesktopCartFocusCaptureState {
  return { hadFocus: false, pendingNullBlurToken: null };
}

export function nextDesktopCartFocusCapture(
  state: DesktopCartFocusCaptureState,
  event: DesktopCartFocusCaptureEvent,
): DesktopCartFocusCaptureState {
  if (event.type === 'focus-inside') {
    return { hadFocus: true, pendingNullBlurToken: null };
  }
  if (event.type === 'related-blur') {
    return { hadFocus: event.relatedTargetInside, pendingNullBlurToken: null };
  }
  if (event.type === 'null-blur') {
    return { hadFocus: state.hadFocus, pendingNullBlurToken: event.token };
  }
  if (event.type === 'resolve-null-blur') {
    if (state.pendingNullBlurToken !== event.token) return state;
    if (event.regionConnected && event.sameRegion) {
      return { hadFocus: event.activeElementInside, pendingNullBlurToken: null };
    }
    return { hadFocus: state.hadFocus, pendingNullBlurToken: null };
  }
  return createDesktopCartFocusCaptureState();
}

export function consumeDesktopCartHadFocus(state: DesktopCartFocusCaptureState): {
  desktopCartHadFocus: boolean;
  next: DesktopCartFocusCaptureState;
} {
  return {
    desktopCartHadFocus: state.hadFocus,
    next: createDesktopCartFocusCaptureState(),
  };
}

export function isRelatedTargetInsideRegion(
  region: { contains?: (node: never) => boolean } | null,
  relatedTarget: EventTarget | null,
): boolean | null {
  if (relatedTarget == null) return null;
  if (region == null || typeof region.contains !== 'function') return false;
  return Boolean(region.contains(relatedTarget as never));
}

export function resolveNullBlurSnapshot(input: {
  blurRegion: { isConnected?: boolean; contains?: (node: never) => boolean } | null;
  currentRegion: { isConnected?: boolean; contains?: (node: never) => boolean } | null;
  activeElement: EventTarget | null;
}): NullBlurRegionSnapshot {
  const sameRegion = input.blurRegion != null && input.blurRegion === input.currentRegion;
  const regionConnected = Boolean(
    sameRegion && input.blurRegion != null && input.blurRegion.isConnected !== false,
  );
  const activeElementInside = Boolean(
    regionConnected &&
      input.currentRegion != null &&
      typeof input.currentRegion.contains === 'function' &&
      input.activeElement != null &&
      input.currentRegion.contains(input.activeElement as never),
  );
  return { regionConnected, sameRegion, activeElementInside };
}
