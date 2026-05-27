'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { manualPointsAdjustment } from '@/app/(main)/jar-exchange/actions';

export function ManualPointsForm({
  customers,
}: {
  customers: { id: string; name: string; customerId: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await manualPointsAdjustment(new FormData(e.currentTarget));
        });
      }}
    >
      <select
        name="customerId"
        required
        className="h-9 min-w-[200px] rounded-xl border border-input bg-card px-2 text-sm"
      >
        <option value="">選擇會員</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.customerId})
          </option>
        ))}
      </select>
      <Input name="pointsChange" type="number" placeholder="點數 ±" className="w-28" required />
      <Input name="note" placeholder="備註" className="min-w-[160px] flex-1" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? '處理中…' : '調整'}
      </Button>
    </form>
  );
}
