'use client';

import { useSyncExternalStore } from 'react';

export const DESKTOP_CHECKOUT_MEDIA = '(min-width: 768px)';

export function isDesktopCheckoutWidth(widthPx: number): boolean {
  return widthPx >= 768;
}

export function getDesktopCheckoutServerSnapshot(): boolean {
  return false;
}

export function getDesktopCheckoutSnapshot(): boolean {
  return window.matchMedia(DESKTOP_CHECKOUT_MEDIA).matches;
}

export function subscribeDesktopCheckout(onStoreChange: () => void): () => void {
  const media = window.matchMedia(DESKTOP_CHECKOUT_MEDIA);
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

export function useDesktopCheckoutLayout(): boolean {
  return useSyncExternalStore(
    subscribeDesktopCheckout,
    getDesktopCheckoutSnapshot,
    getDesktopCheckoutServerSnapshot,
  );
}
