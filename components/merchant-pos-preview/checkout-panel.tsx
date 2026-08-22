'use client';

import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  AVAILABLE_QTY_LABEL,
  CART_EMPTY,
  CHECKOUT_INTRO,
  LIST_PRICE_LABEL,
  SEARCH_EMPTY,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  SOLD_OUT_BADGE,
} from '@/lib/merchant-pos-preview/copy';
import { formatQty, formatTwd, stockLevelLabel } from '@/lib/merchant-pos-preview/formatters';
import { catalogRows, skuAvailability } from '@/lib/merchant-pos-preview/selectors';
import type { MerchantPosSession } from '@/lib/merchant-pos-preview/types';
import { nextCatalogStepperCommand } from './catalog-quantity-stepper-command';
import { CatalogQuantityStepper } from './catalog-quantity-stepper';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { PreviewSpecChip } from './preview-spec-chip';

export function CheckoutPanel({
  session,
  showInlineCartEmpty,
  onQuery,
  onSelectVariant,
  onAdd,
  onStepQty,
  onViewRestock,
}: {
  session: MerchantPosSession;
  showInlineCartEmpty: boolean;
  onQuery: (query: string) => void;
  onSelectVariant: (productId: string, skuId: string) => void;
  onAdd: (productId: string) => void;
  onStepQty: (skuId: string, delta: number) => void;
  onViewRestock: () => void;
}) {
  const rows = catalogRows(session);

  return (
    <section aria-labelledby="checkout-title" className="min-w-0 space-y-4">
      <div className={styles.pageHeader}>
        <h2 id="checkout-title" className={`${styles.sectionTitle} ${styles.checkoutTitle}`} tabIndex={-1}>
          收銀
        </h2>
        <p className={styles.sectionIntro}>{CHECKOUT_INTRO}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="product-search" className={styles.fieldLabel}>
          {SEARCH_LABEL}
        </label>
        <input
          id="product-search"
          value={session.query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          className={`${styles.field} min-h-[44px]`}
        />
      </div>

      {rows.length === 0 ? (
        <p className={styles.notice}>{SEARCH_EMPTY}</p>
      ) : (
        <ul className={styles.productGrid}>
          {rows.map((row) => {
            const selected = row.selected;
            const badge = row.stockLevel ? stockLevelLabel(row.stockLevel) : null;
            const addHintId = `add-hint-${row.product.productId}`;
            const visiblePrices = row.visibleVariants.map((variant) => variant.listPriceTwd);
            const lowestPrice = Math.min(...visiblePrices);
            const highestPrice = Math.max(...visiblePrices);
            const priceRange = lowestPrice === highestPrice
              ? formatTwd(lowestPrice)
              : `${formatTwd(lowestPrice)}–${formatTwd(highestPrice)}`;
            return (
              <li key={row.product.productId} className={styles.productTile}>
                <div className={styles.productHeading}>
                  <p className={styles.productName}>{row.product.name}</p>
                  <p className={styles.productPriceRange} aria-label={`價格 ${priceRange}`}>{priceRange}</p>
                </div>
                <div className={`${styles.specRow} mt-3`}>
                  {row.visibleVariants.map((variant) => {
                    const pressed = selected?.skuId === variant.skuId;
                    const variantAvail = skuAvailability(variant.skuId, session.cart);
                    const soldOut = variantAvail.reason === 'sold_out';
                    const priceLabel = formatTwd(variant.listPriceTwd);
                    const variantLabel = soldOut
                      ? `${variant.specLabel}，${priceLabel}，${SOLD_OUT_BADGE}`
                      : `${variant.specLabel}，${priceLabel}`;
                    return (
                      <PreviewSpecChip
                        key={variant.skuId}
                        selected={pressed}
                        soldOut={soldOut}
                        aria-label={variantLabel}
                        onClick={() => onSelectVariant(row.product.productId, variant.skuId)}
                        specLabel={variant.specLabel}
                        priceLabel={priceLabel}
                        soldOutLabel={SOLD_OUT_BADGE}
                      />
                    );
                  })}
                </div>
                {selected || row.stockLevel || row.add.showRestock ? (
                  <div className={`${styles.productMeta} mt-3`}>
                    {selected ? (
                      <div className={styles.selectedPriceBlock}>
                        <span>{LIST_PRICE_LABEL}</span>
                        <strong>{formatTwd(selected.listPriceTwd)}</strong>
                        <small>{AVAILABLE_QTY_LABEL} {formatQty(selected.availableQty)}</small>
                      </div>
                    ) : null}
                    {badge ? (
                      <p
                        className={
                          row.stockLevel === 'sold_out' ? styles.stockMarkSoldOut : styles.stockMark
                        }
                      >
                        {badge}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {row.add.showRestock ? (
                  <PreviewAction
                    tone={PREVIEW_ACTION_TONES.viewRestock}
                    className={`${styles.actionBlock} min-h-[44px] mt-3`}
                    onClick={onViewRestock}
                  >
                    {row.add.buttonLabel}
                  </PreviewAction>
                ) : selected ? (
                  <CatalogQuantityStepper
                    productName={row.product.name}
                    specLabel={selected.specLabel}
                    availability={skuAvailability(selected.skuId, session.cart)}
                    hintId={addHintId}
                    onIncrease={() => {
                      const command = nextCatalogStepperCommand(
                        skuAvailability(selected.skuId, session.cart),
                        'increase',
                      );
                      if (command.type === 'add-selected') onAdd(row.product.productId);
                      if (command.type === 'add-cart-qty') onStepQty(selected.skuId, command.delta);
                    }}
                    onDecrease={() => {
                      const command = nextCatalogStepperCommand(
                        skuAvailability(selected.skuId, session.cart),
                        'decrease',
                      );
                      if (command.type === 'add-cart-qty') onStepQty(selected.skuId, command.delta);
                    }}
                  />
                ) : row.add.hint ? (
                  <p id={addHintId} className={`${styles.hint} mt-2`}>
                    {row.add.hint}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {showInlineCartEmpty && session.cart.length === 0 ? (
        <p className={styles.hint}>{CART_EMPTY}</p>
      ) : null}
    </section>
  );
}
