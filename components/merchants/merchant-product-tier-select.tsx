'use client';

import {
  findTier,
  hasMultipleTierOptions,
  tierWeightGramsValue,
  type MerchantProductTierOption,
} from '@/lib/merchant-product-tier';
import { variationLabel } from '@/lib/product-variations';

export function MerchantProductTierSelect({
  tiers,
  tierId,
  onTierIdChange,
  idPrefix,
}: {
  tiers: MerchantProductTierOption[];
  tierId: string;
  onTierIdChange: (tierId: string) => void;
  idPrefix: string;
}) {
  if (!hasMultipleTierOptions(tiers)) return null;

  const selected = findTier(tiers, tierId) ?? tiers[0];

  return (
    <div className="space-y-1">
      <label htmlFor={`${idPrefix}-tier`} className="text-xs font-medium">
        規格（克數）
      </label>
      <select
        id={`${idPrefix}-tier`}
        name="tierId"
        required
        value={tierId}
        onChange={(e) => onTierIdChange(e.target.value)}
        className="block w-full min-w-[8rem] rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {tiers.map((tier) => (
          <option key={tier.id} value={tier.id}>
            {variationLabel(tier)}
            {tier.notes ? ` · ${tier.notes}` : ''}
          </option>
        ))}
      </select>
      <input type="hidden" name="weightGrams" value={tierWeightGramsValue(selected)} />
    </div>
  );
}
