import type { SkuAvailability } from '@/lib/merchant-pos-preview/types';

export type CatalogStepperCommand =
  | { type: 'add-selected' }
  | { type: 'add-cart-qty'; delta: 1 | -1 }
  | { type: 'none' };

export function catalogStepperControls(
  availability: Pick<SkuAvailability, 'committedCartQty' | 'canAdd' | 'qtyDraftValid'>,
): {
  committedCartQty: number;
  canIncrease: boolean;
  canDecrease: boolean;
} {
  return {
    committedCartQty: availability.committedCartQty,
    canIncrease: availability.canAdd,
    canDecrease: availability.committedCartQty > 0 && availability.qtyDraftValid,
  };
}

export function nextCatalogStepperCommand(
  availability: Pick<SkuAvailability, 'committedCartQty' | 'canAdd' | 'qtyDraftValid'>,
  action: 'increase' | 'decrease',
): CatalogStepperCommand {
  const controls = catalogStepperControls(availability);
  if (action === 'increase') {
    if (!controls.canIncrease) return { type: 'none' };
    return controls.committedCartQty === 0
      ? { type: 'add-selected' }
      : { type: 'add-cart-qty', delta: 1 };
  }
  if (!controls.canDecrease) return { type: 'none' };
  return { type: 'add-cart-qty', delta: -1 };
}
