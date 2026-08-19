'use client';

import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  ACTUAL_PRICE_HINT,
  ACTUAL_PRICE_LABEL,
  ACTUAL_SUBTOTAL_LABEL,
  CART_EMPTY,
  CART_QTY_LABEL,
  CART_TITLE,
  COMPLETE_SALE,
  DECREASE_QTY,
  INCREASE_QTY,
  ITEM_COUNT_LABEL,
  LIST_PRICE_LABEL,
  LIST_SUBTOTAL_LABEL,
  REMOVE_LINE,
} from '@/lib/merchant-pos-preview/copy';
import { allowanceLabel, formatQty, formatTwd } from '@/lib/merchant-pos-preview/formatters';
import { cartLineTotals, cartTotals, findProductBySku, skuAvailability } from '@/lib/merchant-pos-preview/selectors';
import type { MerchantPosSession } from '@/lib/merchant-pos-preview/types';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';

export function CartWorkspace({
  session,
  onQty,
  onQtyInput,
  onQtyCommit,
  onRemove,
  onPrice,
  onAskComplete,
}: {
  session: MerchantPosSession;
  onQty: (skuId: string, delta: number) => void;
  onQtyInput: (skuId: string, value: string) => void;
  onQtyCommit: (skuId: string) => void;
  onRemove: (skuId: string) => void;
  onPrice: (skuId: string, value: string) => void;
  onAskComplete: () => void;
}) {
  const totals = cartTotals(session.cart);

  return (
    <div className={styles.cartWorkspace}>
      <h3 className={styles.cartWorkspaceTitle}>{CART_TITLE}</h3>
      {session.cart.length === 0 ? (
        <p className={styles.hint}>{CART_EMPTY}</p>
      ) : (
        <>
          <ul className={`${styles.workspaceList} ${styles.cartWorkspaceLines}`}>
            {session.cart.map((line) => {
              const product = findProductBySku(line.skuId);
              const result = cartLineTotals(line);
              const priceId = `actual-price-${line.skuId}`;
              const priceErrorId = `${priceId}-error`;
              const qtyId = `cart-qty-${line.skuId}`;
              const qtyErrorId = `${qtyId}-error`;
              const productName = product?.name ?? '';
              const specLabel = result.variant?.specLabel ?? '';
              const lineContext = `${productName} ${specLabel}`.trim();
              const qtyLabel = `${CART_QTY_LABEL}，${lineContext}`;
              const decreaseLabel = `${DECREASE_QTY}，${lineContext}`;
              const increaseLabel = `${INCREASE_QTY}，${lineContext}`;
              const removeLabel = `${REMOVE_LINE}，${lineContext}`;
              const availability = skuAvailability(line.skuId, session.cart);
              return (
                <li key={line.skuId} className={styles.workspaceRow}>
                  <p className={styles.productName}>{product?.name}</p>
                  <p className={styles.productSpec}>{result.variant?.specLabel}</p>
                  <p className={`${styles.productMeta} mt-1`}>
                    {LIST_PRICE_LABEL} {result.variant ? formatTwd(result.variant.listPriceTwd) : '—'}
                  </p>
                  <div className={`${styles.inlineActions} mt-3`}>
                    <PreviewAction
                      tone={PREVIEW_ACTION_TONES.cartQtyStep}
                      className="min-h-[44px] min-w-[44px]"
                      aria-label={decreaseLabel}
                      onClick={() => onQty(line.skuId, -1)}
                    >
                      −
                    </PreviewAction>
                    <div className="min-w-[5.5rem] space-y-1.5">
                      <label htmlFor={qtyId} className={styles.fieldLabel}>
                        {CART_QTY_LABEL}
                      </label>
                      <input
                        id={qtyId}
                        inputMode="numeric"
                        value={line.qtyInput}
                        aria-label={qtyLabel}
                        aria-invalid={Boolean(result.qtyError)}
                        aria-describedby={result.qtyError ? qtyErrorId : undefined}
                        className={`${styles.field} ${styles.qtyField} min-h-[44px]`}
                        onChange={(event) => onQtyInput(line.skuId, event.target.value)}
                        onBlur={() => onQtyCommit(line.skuId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            onQtyCommit(line.skuId);
                          }
                        }}
                      />
                    </div>
                    <PreviewAction
                      tone={PREVIEW_ACTION_TONES.cartQtyStep}
                      className="min-h-[44px] min-w-[44px]"
                      aria-label={increaseLabel}
                      disabled={!availability.canAdd}
                      onClick={() => onQty(line.skuId, 1)}
                    >
                      ＋
                    </PreviewAction>
                    <PreviewAction
                      tone={PREVIEW_ACTION_TONES.removeCartLine}
                      className="min-h-[44px]"
                      aria-label={removeLabel}
                      onClick={() => onRemove(line.skuId)}
                    >
                      {REMOVE_LINE}
                    </PreviewAction>
                  </div>
                  {result.qtyError ? (
                    <p id={qtyErrorId} role="alert" className={styles.errorText}>
                      {result.qtyError}
                    </p>
                  ) : null}
                  <div className="mt-3 space-y-1.5">
                    <label htmlFor={priceId} className={styles.fieldLabel}>
                      {ACTUAL_PRICE_LABEL}
                    </label>
                    <input
                      id={priceId}
                      inputMode="numeric"
                      value={line.actualUnitPriceInput}
                      aria-invalid={Boolean(result.priceError)}
                      aria-describedby={result.priceError ? priceErrorId : undefined}
                      className={`${styles.field} min-h-[44px]`}
                      onChange={(event) => onPrice(line.skuId, event.target.value)}
                    />
                    <p className={styles.quietNote}>{ACTUAL_PRICE_HINT}</p>
                    {result.priceError ? (
                      <p id={priceErrorId} role="alert" className={styles.errorText}>
                        {result.priceError}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className={styles.cartWorkspaceSummary}>
            <dl className={styles.defList}>
              <div className={styles.defRow}>
                <dt>{LIST_SUBTOTAL_LABEL}</dt>
                <dd>{formatTwd(totals.listSubtotalTwd)}</dd>
              </div>
              <div className={styles.defRow}>
                <dt>{ACTUAL_SUBTOTAL_LABEL}</dt>
                <dd>{totals.blocked ? '—' : formatTwd(totals.actualSubtotalTwd)}</dd>
              </div>
              <div className={styles.defRow}>
                <dt>{allowanceLabel(totals.allowanceTwd)}</dt>
                <dd>{totals.blocked ? '—' : formatTwd(Math.abs(totals.allowanceTwd))}</dd>
              </div>
              <div className={styles.defRow}>
                <dt>{ITEM_COUNT_LABEL}</dt>
                <dd>{formatQty(totals.itemCount)}</dd>
              </div>
            </dl>

            <PreviewAction
              tone={PREVIEW_ACTION_TONES.completeSalePreview}
              className={`${styles.actionBlock} min-h-[44px]`}
              disabled={totals.blocked}
              onClick={onAskComplete}
            >
              {COMPLETE_SALE}
            </PreviewAction>
          </div>
        </>
      )}
    </div>
  );
}
