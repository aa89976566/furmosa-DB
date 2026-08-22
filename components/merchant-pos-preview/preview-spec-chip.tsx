'use client';

import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';

export function PreviewSpecChip({
  selected,
  soldOut,
  onClick,
  specLabel,
  priceLabel,
  soldOutLabel,
  'aria-label': ariaLabel,
}: {
  selected: boolean;
  soldOut: boolean;
  onClick: () => void;
  specLabel: string;
  priceLabel: string;
  soldOutLabel: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      className={[
        styles.specChip,
        selected ? styles.specChipSelected : '',
        soldOut ? styles.specChipSoldOut : '',
        'min-h-[44px]',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      <span className={styles.specChipLabel}>{specLabel}</span>
      {soldOut ? <span className={styles.specChipStatus}>{soldOutLabel}</span> : null}
      <span className={styles.specChipPrice}>{priceLabel}</span>
    </button>
  );
}
