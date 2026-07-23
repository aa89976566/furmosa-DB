'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { subscriptionPaymentTypeLabel } from '@/lib/labels';
import { customerShippingDefaults } from '@/lib/customer-shipping-defaults';
import {
  createSubscriptionAction,
  searchCustomersForSubscription,
  type CreateSubscriptionState,
} from '@/app/(main)/subscriptions/create-subscription-action';
import {
  MerchantField,
  MerchantFormActions,
  MerchantSection,
} from '@/components/merchants/merchant-ui';
import { CustomerSearchSelect } from '@/components/customers/customer-search-select';

export type SubscriptionCreateCustomerOption = {
  id: string;
  name: string;
  customerId: string;
  phone: string | null;
  address: string | null;
  preferredShippingMethod: string | null;
  preferredCvsBrand: string | null;
  preferredCvsStoreName: string | null;
};

export type SubscriptionCreatePlanOption = {
  id: string;
  planCode: string;
  name: string;
  monthlyPrice: number;
  halfYearPrice: number | null;
  shipmentsPerMonth: number;
};

const initialState: CreateSubscriptionState = { error: null };

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function SubscriptionCreateForm({
  customers: initialCustomers,
  plans,
}: {
  customers: SubscriptionCreateCustomerOption[];
  plans: SubscriptionCreatePlanOption[];
}) {
  const [state, formAction] = useFormState(createSubscriptionAction, initialState);
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState(initialCustomers[0]?.id ?? '');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'halfyear'>('monthly');
  const [unlimitedEnd, setUnlimitedEnd] = useState(true);
  const [paymentType, setPaymentType] = useState<'full' | 'monthly' | 'other'>('monthly');

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId],
  );

  const shippingDefaults = useMemo(
    () => (selectedCustomer ? customerShippingDefaults(selectedCustomer) : null),
    [selectedCustomer],
  );

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');

  useEffect(() => {
    if (!shippingDefaults) return;
    setRecipientName(shippingDefaults.recipientName);
    setRecipientPhone(shippingDefaults.recipientPhone);
    setShippingAddress(shippingDefaults.shippingAddress);
  }, [shippingDefaults]);

  const handleSearchCustomers = useCallback(async (query: string) => {
    const rows = await searchCustomersForSubscription(query);
    setCustomers((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      for (const row of rows) {
        map.set(row.id, {
          id: row.id,
          name: row.name,
          customerId: row.customerId,
          phone: row.phone,
          address: row.address,
          preferredShippingMethod: row.preferredShippingMethod,
          preferredCvsBrand: row.preferredCvsBrand,
          preferredCvsStoreName: row.preferredCvsStoreName,
        });
      }
      return [...map.values()];
    });
    return rows;
  }, []);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <MerchantSection
        step={1}
        title="客戶與方案"
        description="選擇訂閱客戶與方案；合約編號建立時自動產生。"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <MerchantField label="客戶" required className="sm:col-span-2">
            <CustomerSearchSelect
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              onSearch={handleSearchCustomers}
              required
              placeholder="搜尋姓名、編號或電話…"
            />
          </MerchantField>

          <MerchantField label="訂閱方案" required className="sm:col-span-2">
            <select
              name="planId"
              required
              defaultValue={plans[0]?.id}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatCurrency(p.monthlyPrice)}/月
                  {p.halfYearPrice ? ` · 半年 ${formatCurrency(p.halfYearPrice)}` : ''}
                  {p.shipmentsPerMonth > 1 ? ` · 每月${p.shipmentsPerMonth}次出貨` : ''}
                </option>
              ))}
            </select>
          </MerchantField>

          <MerchantField label="付款週期" required>
            <select
              name="billingCycle"
              value={billingCycle}
              onChange={(e) => {
                const v = e.target.value as 'monthly' | 'halfyear';
                setBillingCycle(v);
                if (v === 'halfyear') setUnlimitedEnd(true);
              }}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="monthly">月繳</option>
              <option value="halfyear">半年繳</option>
            </select>
          </MerchantField>

          <MerchantField label="開始日期" required>
            <Input name="startDate" type="date" required defaultValue={todayStr()} />
          </MerchantField>

          <div className="sm:col-span-2 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="unlimitedEnd"
                checked={unlimitedEnd}
                onChange={(e) => setUnlimitedEnd(e.target.checked)}
                className="rounded border-input"
              />
              <span>
                {billingCycle === 'halfyear'
                  ? '依開始日自動計算半年到期（不手動指定）'
                  : '無限期（不設定到期日）'}
              </span>
            </label>
            {!unlimitedEnd ? (
              <MerchantField label="到期日">
                <Input name="endDate" type="date" />
              </MerchantField>
            ) : null}
          </div>
        </div>
      </MerchantSection>

      <MerchantSection
        step={2}
        title="收件與付款"
        description="選客戶後會帶入檔案中的收件資料，可再修改。"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <MerchantField label="收件人" required>
            <Input
              name="recipientName"
              required
              maxLength={80}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </MerchantField>
          <MerchantField label="收件電話" required>
            <Input
              name="recipientPhone"
              required
              type="tel"
              maxLength={40}
              className="font-mono tabular-nums"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
            />
          </MerchantField>
          <MerchantField label="收件地址／門市" required className="sm:col-span-2">
            <textarea
              name="shippingAddress"
              required
              rows={2}
              maxLength={300}
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="宅配地址或 7-11 · 門市名稱"
              className="block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </MerchantField>

          <MerchantField label="付款方式" required className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              {(['monthly', 'full', 'other'] as const).map((key) => (
                <label
                  key={key}
                  className={`inline-flex cursor-pointer items-center rounded-xl border px-3 py-2 text-sm ${
                    paymentType === key
                      ? 'border-primary bg-primary/5 font-medium text-navy'
                      : 'border-border/70 text-muted-foreground'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentType"
                    value={key}
                    checked={paymentType === key}
                    onChange={() => setPaymentType(key)}
                    className="sr-only"
                  />
                  {subscriptionPaymentTypeLabel[key]}
                </label>
              ))}
            </div>
          </MerchantField>

          {paymentType === 'other' ? (
            <MerchantField label="付款說明" className="sm:col-span-2">
              <Input name="paymentNote" maxLength={200} placeholder="例：匯款後每月對帳" />
            </MerchantField>
          ) : null}

          <MerchantField label="備註（選填）" className="sm:col-span-2">
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              className="block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </MerchantField>
        </div>
      </MerchantSection>

      <MerchantSection step={3} title="建立" description="會自動產生近兩個月的出貨排程。">
        <MerchantFormActions className="border-t-0 pt-0">
          <SubmitButton />
        </MerchantFormActions>
      </MerchantSection>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="mr-1 h-4 w-4" />
      {pending ? '建立中…' : '建立訂閱'}
    </Button>
  );
}
