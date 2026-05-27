'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createRewardCatalogItem } from '@/app/(main)/jar-exchange/actions';

export function RewardCatalogForm({
  merchants,
}: {
  merchants: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await createRewardCatalogItem(new FormData(e.currentTarget));
        });
      }}
    >
      <Input name="rewardName" placeholder="例：洗澡折 100" required />
      <Input name="pointsRequired" type="number" min={1} placeholder="所需點數" required />
      <Input name="couponFaceValue" type="number" min={0} step="1" placeholder="券面額" required />
      <Input name="internalCost" type="number" min={0} step="1" placeholder="公司成本" required />
      <select
        name="partnerMerchantId"
        className="h-10 rounded-xl border border-input bg-card px-2 text-sm"
      >
        <option value="">合作店家（選填）</option>
        {merchants.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <Input name="description" placeholder="說明（選填）" className="sm:col-span-2" />
      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {pending ? '建立中…' : '新增獎勵'}
      </Button>
    </form>
  );
}
