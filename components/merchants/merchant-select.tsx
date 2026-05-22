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
}: {
  merchants: MerchantOption[];
  value: string;
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
