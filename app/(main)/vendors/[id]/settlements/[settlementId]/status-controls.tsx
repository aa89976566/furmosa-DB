'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  updateVendorSettlementStatus,
  type VendorSettlementStatusActionState,
} from '../actions';
import { vendorSettlementNextActions } from '@/lib/vendor-settlement-status';

const initialState: VendorSettlementStatusActionState = { ok: false, message: '' };
const labels: Record<string, string> = {
  draft: '退回草稿',
  reviewing: '送交核對',
  approved: '確認對帳',
  paid: '標記已付款',
};

export function VendorSettlementStatusControls({
  vendorId,
  settlementId,
  status,
  actorRole,
}: {
  vendorId: string;
  settlementId: string;
  status: string;
  actorRole: string;
}) {
  const [state, action, pending] = useActionState(updateVendorSettlementStatus, initialState);
  const actions = vendorSettlementNextActions(status, actorRole);
  if (!actions.length) return null;

  return (
    <div className="space-y-2">
      {actions.includes('paid') ? (
        <div className="ml-auto max-w-sm space-y-1 text-left">
          <label htmlFor="paymentReference" className="text-xs font-medium">
            付款憑證／轉帳末五碼
          </label>
          <p className="text-xs text-muted-foreground">填寫後才能標記已付款，並會保留在稽核紀錄。</p>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {actions.map((next) => (
          <form action={action} key={next} className={next === 'paid' ? 'flex flex-wrap items-end justify-end gap-2' : undefined}>
            <input type="hidden" name="vendorId" value={vendorId} />
            <input type="hidden" name="settlementId" value={settlementId} />
            <input type="hidden" name="expectedStatus" value={status} />
            <input type="hidden" name="nextStatus" value={next} />
            {next === 'paid' ? (
              <Input
                id="paymentReference"
                name="paymentReference"
                required
                minLength={3}
                maxLength={200}
                placeholder="例：轉帳末五碼 12345"
                className="w-60"
              />
            ) : null}
            <Button
              type="submit"
              variant={next === 'paid' || next === 'approved' ? 'default' : 'outline'}
              disabled={pending}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {labels[next] ?? next}
            </Button>
          </form>
        ))}
      </div>
      {state.message ? (
        <p className={`text-right text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
