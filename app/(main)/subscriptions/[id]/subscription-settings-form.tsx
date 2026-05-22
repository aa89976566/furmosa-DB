'use client';

import Link from 'next/link';
import { useState } from 'react';
import { updateSubscriptionSettings } from './actions';
import { Button } from '@/components/ui/button';
import { subscriptionPaymentTypeLabel } from '@/lib/labels';

const PAYMENT_TYPES = ['full', 'monthly', 'other'] as const;

export function SubscriptionSettingsForm({
  subscriptionId,
  currentPlanId,
  currentEndDate,
  currentPaymentType,
  currentPaymentNote,
  plans,
}: {
  subscriptionId: string;
  currentPlanId: string;
  currentEndDate: Date | null;
  currentPaymentType: string;
  currentPaymentNote: string;
  plans: { id: string; planCode: string; name: string; monthlyPrice: number }[];
}) {
  const unlimitedInitially = currentEndDate == null;
  const [unlimited, setUnlimited] = useState(unlimitedInitially);

  const normalizedPayment =
    PAYMENT_TYPES.includes(currentPaymentType as (typeof PAYMENT_TYPES)[number])
      ? currentPaymentType
      : 'monthly';
  const [paymentType, setPaymentType] = useState(normalizedPayment);

  const endDateStr = currentEndDate
    ? `${currentEndDate.getFullYear()}-${String(currentEndDate.getMonth() + 1).padStart(2, '0')}-${String(currentEndDate.getDate()).padStart(2, '0')}`
    : '';

  return (
    <form action={updateSubscriptionSettings} className="space-y-4">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />

      <div className="space-y-2">
        <label htmlFor="planId" className="text-sm font-medium">
          訂閱方案
        </label>
        <select
          id="planId"
          name="planId"
          required
          defaultValue={currentPlanId}
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} ({plan.planCode}) · ${Math.round(plan.monthlyPrice)} / 月
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          更換方案後，此頁「方案內容」會套用新方案；已排定的出貨請視需要另行調整。
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">方案到期日</span>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={endDateStr}
            disabled={unlimited}
            className="w-full max-w-[11rem] rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 sm:w-auto"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="unlimitedEnd"
              value="on"
              checked={unlimited}
              onChange={(event) => setUnlimited(event.target.checked)}
              className="rounded border-input"
            />
            無限期
          </label>
        </div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <label htmlFor="paymentType" className="text-sm font-medium">
          付款資訊
        </label>
        <select
          id="paymentType"
          name="paymentType"
          required
          value={paymentType}
          onChange={(event) => setPaymentType(event.target.value)}
          className="block w-full max-w-md rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {PAYMENT_TYPES.map((key) => (
            <option key={key} value={key}>
              {subscriptionPaymentTypeLabel[key]}
            </option>
          ))}
        </select>
        {paymentType === 'other' && (
          <div className="space-y-1">
            <label htmlFor="paymentNote" className="text-xs text-muted-foreground">
              其他付款說明（選填）
            </label>
            <textarea
              id="paymentNote"
              name="paymentNote"
              rows={3}
              defaultValue={currentPaymentNote}
              placeholder="例：季付轉帳後五碼、分期約定…"
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm">
          儲存訂閱設定
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/subscriptions/plans">編輯方案主檔</Link>
        </Button>
      </div>
    </form>
  );
}
