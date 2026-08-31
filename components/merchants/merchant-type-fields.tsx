'use client';

import {
  MERCHANT_COOPERATION_TYPES,
  MERCHANT_TAG_TYPES,
  merchantTypeLabel,
  type MerchantType,
} from '@/lib/merchant-types';
import { MerchantField } from '@/components/merchants/merchant-ui';
import { cn } from '@/lib/utils';

const cooperationDescription: Record<(typeof MERCHANT_COOPERATION_TYPES)[number], string> = {
  consignment: '先放店內銷售，售出後再對帳',
  wholesale: '店家買斷進貨，成立時認列銷售',
  jar_exchange: '補充換罐專用商品',
};

export function MerchantTypeFields({
  defaultTypes = [],
  className,
}: {
  defaultTypes?: MerchantType[];
  className?: string;
}) {
  const selected = new Set(defaultTypes);

  return (
    <MerchantField label="合作方式" required className={cn('sm:col-span-2', className)}>
      <p className="mb-3 text-xs text-muted-foreground">可複選，至少選一項</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {MERCHANT_COOPERATION_TYPES.map((value) => (
          <label
            key={value}
            className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border bg-background px-4 py-3 text-foreground transition-colors hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input
              type="checkbox"
              name="types"
              value={value}
              defaultChecked={selected.has(value)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-ring"
            />
            <span>
              <strong className="block text-sm font-semibold">{merchantTypeLabel[value]}</strong>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {cooperationDescription[value]}
              </span>
            </span>
          </label>
        ))}
      </div>

      <details className="mt-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          其他店家標籤（選填）
        </summary>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {MERCHANT_TAG_TYPES.map((value) => (
            <label
              key={value}
              className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground"
            >
              <input
                type="checkbox"
                name="types"
                value={value}
                defaultChecked={selected.has(value)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              {merchantTypeLabel[value]}
            </label>
          ))}
        </div>
      </details>
    </MerchantField>
  );
}
