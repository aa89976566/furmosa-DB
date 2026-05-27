'use client';

import { MERCHANT_TYPES, merchantTypeLabel, type MerchantType } from '@/lib/merchant-types';
import { MerchantField } from '@/components/merchants/merchant-ui';
import { cn } from '@/lib/utils';

export function MerchantTypeFields({
  defaultTypes = ['consignment'],
  className,
}: {
  defaultTypes?: MerchantType[];
  className?: string;
}) {
  const selected = new Set(defaultTypes);

  return (
    <MerchantField label="類型" required className={cn('sm:col-span-2', className)}>
      <p className="mb-2 text-xs text-muted-foreground">可複選，至少選一項</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {MERCHANT_TYPES.map((value) => (
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
    </MerchantField>
  );
}
