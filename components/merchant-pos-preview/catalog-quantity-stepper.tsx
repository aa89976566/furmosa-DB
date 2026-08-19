'use client';

import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  AT_STOCK_CAP,
  CART_QTY_LABEL,
  DECREASE_QTY,
  FIX_CART_QTY,
  INCREASE_QTY,
  STOCK_ALL_IN_CART,
  cartHasQtyLabel,
} from '@/lib/merchant-pos-preview/copy';
import type { SkuAvailability } from '@/lib/merchant-pos-preview/types';
import { catalogStepperControls } from './catalog-quantity-stepper-command';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';

export function CatalogQuantityStepper({
  productName,
  specLabel,
  availability,
  hintId,
  onIncrease,
  onDecrease,
}: {
  productName: string;
  specLabel: string;
  availability: SkuAvailability;
  hintId?: string;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const controls = catalogStepperControls(availability);
  const lineContext = `${productName} ${specLabel}`.trim();
  const decreaseLabel = `${DECREASE_QTY}，${lineContext}`;
  const increaseLabel = `${INCREASE_QTY}，${lineContext}`;
  const qtyLabel = `${CART_QTY_LABEL}，${lineContext}`;
  const statusId = hintId;
  const capHintId = statusId ? `${statusId}-cap` : undefined;
  const invalidHintId = statusId ? `${statusId}-fix` : undefined;
  const describedBy = [
    statusId,
    availability.reason === 'at_cap' ? capHintId : null,
    availability.reason === 'invalid_qty' ? invalidHintId : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.catalogQtyStepper} role="group" aria-label={qtyLabel}>
      <div className={styles.catalogQtyRow}>
        <PreviewAction
          tone={PREVIEW_ACTION_TONES.cartQtyStep}
          className="min-h-[44px] min-w-[44px]"
          aria-label={decreaseLabel}
          aria-describedby={describedBy || undefined}
          disabled={!controls.canDecrease}
          onClick={onDecrease}
        >
          −
        </PreviewAction>
        <p className={styles.catalogQtyValue} aria-hidden="true">
          {controls.committedCartQty}
        </p>
        <PreviewAction
          tone={PREVIEW_ACTION_TONES.cartQtyStep}
          className="min-h-[44px] min-w-[44px]"
          aria-label={increaseLabel}
          aria-describedby={describedBy || undefined}
          disabled={!controls.canIncrease}
          onClick={onIncrease}
        >
          ＋
        </PreviewAction>
      </div>
      <p id={statusId} className={styles.catalogQtyStatus}>
        {cartHasQtyLabel(controls.committedCartQty)}
      </p>
      {availability.reason === 'at_cap' ? (
        <p id={capHintId} className={styles.hint}>
          {AT_STOCK_CAP}。{STOCK_ALL_IN_CART}
        </p>
      ) : null}
      {availability.reason === 'invalid_qty' ? (
        <p id={invalidHintId} className={styles.hint}>
          {FIX_CART_QTY}
        </p>
      ) : null}
    </div>
  );
}
