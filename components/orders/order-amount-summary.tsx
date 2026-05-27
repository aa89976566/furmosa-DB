import { formatCurrency } from '@/lib/format';
import {
  buildOrderAmountSummary,
  type OrderAmountInput,
} from '@/lib/order-amount-summary';
import { cn } from '@/lib/utils';

export function OrderAmountSummary({
  order,
  className,
}: {
  order: OrderAmountInput;
  className?: string;
}) {
  const summary = buildOrderAmountSummary(order);

  return (
    <div className={cn('space-y-1.5 text-sm', className)}>
      {summary.lines.map((line) => (
        <div key={line.key} className="flex justify-between gap-4">
          <span
            className={cn(
              'text-muted-foreground',
              line.tone === 'success' && 'text-success',
            )}
          >
            {line.label}
            {line.hint ? (
              <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                {line.hint}
              </span>
            ) : null}
          </span>
          <span
            className={cn(
              'shrink-0 tabular-nums',
              line.tone === 'success' && 'text-success',
              line.value < 0 && 'text-success',
            )}
          >
            {line.value < 0 ? '- ' : ''}
            {formatCurrency(Math.abs(line.value))}
          </span>
        </div>
      ))}

      <div className="flex justify-between border-t pt-2 text-base font-semibold">
        <span>合計（買家應付）</span>
        <span>{formatCurrency(summary.buyerTotal)}</span>
      </div>

      {summary.companyShippingCost > 0 ? (
        <div className="flex justify-between rounded-md bg-warning/5 px-2 py-1.5 text-xs text-warning">
          <span>公司運費成本</span>
          <span className="tabular-nums">{formatCurrency(summary.companyShippingCost)}</span>
        </div>
      ) : null}
      {summary.giftCost > 0 ? (
        <div className="flex justify-between rounded-md bg-warning/5 px-2 py-1.5 text-xs text-warning">
          <span>贈品成本（公司開銷）</span>
          <span className="tabular-nums">{formatCurrency(summary.giftCost)}</span>
        </div>
      ) : null}

      {summary.companyShippingCost > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          公司運費成本不計入買家合計；{summary.feeTypeLabel}。
        </p>
      ) : null}

      {summary.totalMismatch ? (
        <p className="text-[11px] text-destructive">
          資料庫 total（{formatCurrency(summary.storedTotal)}）與試算不符，請重新切換運費類型同步。
        </p>
      ) : null}
    </div>
  );
}
