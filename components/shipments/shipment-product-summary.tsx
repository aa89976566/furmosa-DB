'use client';

import {
  PRODUCT_ANOMALY_MESSAGE,
  PRODUCT_EMPTY_MESSAGE,
  PRODUCT_LOADING_MESSAGE,
  formatProductSummaryTooltip,
  type ProductSummaryModel,
} from '@/lib/shipment-queue-products';
import { cn } from '@/lib/utils';

export function ShipmentProductSummary({
  model,
  loading = false,
  className,
}: {
  model?: ProductSummaryModel | null;
  loading?: boolean;
  className?: string;
}) {
  if (loading || !model) {
    return (
      <div
        className={cn('min-w-[280px] space-y-1.5', className)}
        aria-busy="true"
        aria-label={PRODUCT_LOADING_MESSAGE}
      >
        <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (model.state === 'anomaly') {
    return (
      <div
        className={cn('min-w-[280px] text-xs font-medium text-destructive', className)}
        title={PRODUCT_ANOMALY_MESSAGE}
        role="status"
      >
        {PRODUCT_ANOMALY_MESSAGE}
      </div>
    );
  }

  if (model.state === 'empty') {
    return (
      <div
        className={cn('min-w-[280px] text-xs text-muted-foreground', className)}
        title={PRODUCT_EMPTY_MESSAGE}
        role="status"
      >
        {PRODUCT_EMPTY_MESSAGE}
      </div>
    );
  }

  const tooltip = formatProductSummaryTooltip(model);

  return (
    <div
      className={cn('min-w-[280px] max-w-md space-y-0.5', className)}
      title={tooltip}
      aria-label={tooltip.replace(/\n/g, '，')}
    >
      {model.visibleLines.map((line) => (
        <p
          key={line}
          className="truncate text-xs leading-5 text-foreground"
          title={line}
        >
          {line}
        </p>
      ))}
      {model.overflowLabel ? (
        <p className="truncate text-[11px] leading-4 text-muted-foreground" title={tooltip}>
          {model.overflowLabel}
        </p>
      ) : null}
    </div>
  );
}
