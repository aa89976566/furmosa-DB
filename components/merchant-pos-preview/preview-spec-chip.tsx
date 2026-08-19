'use client';

import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';

export function PreviewSpecChip({
  selected,
  soldOut,
  onClick,
  children,
  'aria-label': ariaLabel,
}: {
  selected: boolean;
  soldOut: boolean;
  onClick: () => void;
  children: React.ReactNode;
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
      {children}
    </button>
  );
}
