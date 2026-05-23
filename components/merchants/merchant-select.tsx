'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type MerchantOption = {
  id: string;
  name: string;
  merchantId: string;
};

export function MerchantSelect({
  merchants,
  value,
  preserveView,
}: {
  merchants: MerchantOption[];
  value: string;
  /** 月結建立頁切換店家時保留 view=create */
  preserveView?: 'create';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      value={value}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('merchantId', event.target.value);
        params.delete('productId');
        if (preserveView === 'create') {
          params.set('view', 'create');
          params.delete('settle_from');
          params.delete('settle_to');
          params.delete('settle_shipping');
          params.delete('settle_reward');
        }
        router.push(`${pathname}?${params.toString()}`);
      }}
      className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {merchants.map((merchant) => (
        <option key={merchant.id} value={merchant.id}>
          {merchant.name} ({merchant.merchantId})
        </option>
      ))}
    </select>
  );
}
