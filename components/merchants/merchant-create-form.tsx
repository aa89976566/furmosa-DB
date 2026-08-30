'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, ChevronRight, Store } from 'lucide-react';
import {
  createMerchantAction,
  type CreateMerchantState,
} from '@/app/(main)/merchants/create-merchant-action';
import {
  MERCHANT_TYPES,
  merchantTypeLabel,
  type MerchantType,
} from '@/lib/merchant-types';

const initialState: CreateMerchantState = { error: null };

export function MerchantCreateForm({ returnTo }: { returnTo?: string }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [types, setTypes] = useState<MerchantType[]>(['consignment']);
  const [state, formAction] = useFormState(createMerchantAction, initialState);

  function toggleType(type: MerchantType) {
    setTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="returnTo" value={returnTo ?? ''} />
      <input type="hidden" name="preferredCarrier" value="" />

      <div className="space-y-2">
        <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          新增合作店家 · {step}／4
        </div>
        <div className="grid grid-cols-4 gap-1.5" aria-hidden>
          {[1, 2, 3, 4].map((item) => (
            <span
              key={item}
              className={`h-1 rounded-full ${
                item <= step ? 'bg-neutral-950 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-800'
              }`}
            />
          ))}
        </div>
      </div>

      {state.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <section hidden={step !== 1} className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">店家基本資料</h2>
        <label className="block space-y-1.5 text-sm font-medium">
          店家名稱
          <Input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            placeholder="例如：墨菲寵物"
            className="mt-1.5"
          />
        </label>
        <StepActions onNext={() => setStep(2)} nextDisabled={!name.trim()} />
      </section>

      <section hidden={step !== 2} className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">聯絡方式</h2>
        <label className="block space-y-1.5 text-sm font-medium">
          聯絡人
          <Input
            name="contactName"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            maxLength={60}
            placeholder="例如：王小姐"
            className="mt-1.5"
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          電話
          <Input
            name="phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={40}
            className="mt-1.5"
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          Email
          <Input
            name="email"
            type="text"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={120}
            className="mt-1.5"
          />
        </label>
        <StepActions onBack={() => setStep(1)} onNext={() => setStep(3)} />
      </section>

      <section hidden={step !== 3} className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">合作類型</h2>
        <div className="grid grid-cols-2 gap-2">
          {MERCHANT_TYPES.map((type) => {
            const selected = types.includes(type);
            return (
              <label
                key={type}
                className={`flex min-h-12 cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
                  selected
                    ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                    : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                }`}
              >
                <span>{merchantTypeLabel[type]}</span>
                <input
                  type="checkbox"
                  name="types"
                  value={type}
                  checked={selected}
                  onChange={() => toggleType(type)}
                  className="sr-only"
                />
                {selected ? <Check className="h-4 w-4" /> : null}
              </label>
            );
          })}
        </div>
        <StepActions
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          nextDisabled={types.length === 0}
        />
      </section>

      <section hidden={step !== 4} className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">確認店家資料</h2>
        <dl className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white px-4 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          <SummaryRow label="店家" value={name} />
          <SummaryRow label="聯絡人" value={contactName || '未填寫'} />
          <SummaryRow label="聯絡方式" value={phone || email || '未填寫'} />
          <SummaryRow label="合作" value={types.map((type) => merchantTypeLabel[type]).join('、')} />
        </dl>
        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <Button type="button" variant="outline" onClick={() => setStep(3)}>
            返回
          </Button>
          <SubmitButton />
        </div>
      </section>
    </form>
  );
}

function StepActions({
  onBack,
  onNext,
  nextDisabled = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          返回
        </Button>
      ) : null}
      <Button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
      >
        繼續
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-3 py-3 text-sm">
      <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="font-medium text-neutral-950 dark:text-white">{value}</dd>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
    >
      <Store className="mr-2 h-4 w-4" />
      {pending ? '建立中…' : '建立店家'}
    </Button>
  );
}
