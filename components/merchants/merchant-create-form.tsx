'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, Search, Store } from 'lucide-react';
import { createMerchantAction } from '@/app/(main)/merchants/create-merchant-action';
import {
  activateMerchantAction,
  searchMerchantsAction,
} from '@/app/(main)/merchants/onboarding-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MERCHANT_COOPERATION_TYPES,
  merchantTypeLabel,
  type MerchantType,
} from '@/lib/merchant-types';
import type { MerchantSearchItem } from '@/lib/merchants/onboarding';
import { cn } from '@/lib/utils';

const cooperationDescription: Record<(typeof MERCHANT_COOPERATION_TYPES)[number], string> = {
  consignment: '商品放在店內，售出後再對帳',
  wholesale: '店家買斷進貨',
  jar_exchange: '提供一罐換一罐服務',
};

type Step = 'search' | 'services' | 'details' | 'confirm';
type StoreDetails = { name: string; contactName: string; phone: string; city: string };

export function MerchantCreateForm() {
  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<MerchantSearchItem[]>([]);
  const [existing, setExisting] = useState<MerchantSearchItem | null>(null);
  const [types, setTypes] = useState<MerchantType[]>([]);
  const [details, setDetails] = useState<StoreDetails>({
    name: '',
    contactName: '',
    phone: '',
    city: '',
  });
  const [createState, createFormAction] = useFormState(createMerchantAction, { error: null });
  const [activateState, activateFormAction] = useFormState(activateMerchantAction, {
    error: null,
  });

  const currentStep = useMemo(
    () => ({ search: 1, services: 2, details: 3, confirm: 4 })[step],
    [step],
  );

  async function search() {
    if (query.trim().length < 2) {
      setSearchError('請輸入至少兩個字');
      return;
    }
    setSearching(true);
    setSearchError(null);
    const result = await searchMerchantsAction(query);
    setSearching(false);
    setSearched(true);
    if (!result.ok) {
      setSearchError(result.error);
      setResults([]);
      return;
    }
    setResults(result.items);
  }

  function chooseExisting(item: MerchantSearchItem) {
    setExisting(item);
    setTypes(
      item.types.filter((type) =>
        MERCHANT_COOPERATION_TYPES.some((cooperation) => cooperation === type),
      ),
    );
    setStep('services');
  }

  function chooseNew() {
    setExisting(null);
    setTypes([]);
    setDetails((current) => ({ ...current, name: query.trim() }));
    setStep('services');
  }

  function toggleType(type: MerchantType) {
    setTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  function back() {
    if (step === 'confirm') setStep(existing ? 'services' : 'details');
    else if (step === 'details') setStep('services');
    else setStep('search');
  }

  const error = createState.error ?? activateState.error;

  return (
    <section className="overflow-hidden rounded-3xl border-2 border-neutral-900 bg-white text-neutral-950 shadow-[6px_6px_0_0_#111]">
      <header className="border-b-2 border-neutral-900 px-5 py-4 sm:px-7">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold">新增合作店家</p>
          <span className="text-sm tabular-nums text-neutral-500">{currentStep} / 4</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full bg-neutral-950 transition-all"
            style={{ width: `${currentStep * 25}%` }}
          />
        </div>
      </header>

      <div className="min-h-[30rem] px-5 py-7 sm:px-7">
        {error ? (
          <p className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {step === 'search' ? (
          <div className="space-y-6">
            <StepTitle title="先找找看店家是否已建立" description="輸入店名、店家編號或電話。" />
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void search();
              }}
            >
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearched(false);
                }}
                className="h-12 rounded-xl border-2 border-neutral-900 text-base"
                placeholder="例：毛孩生活"
                autoFocus
              />
              <Button type="submit" className="h-12 bg-neutral-950 px-5 text-white">
                <Search className="mr-1 h-4 w-4" />
                {searching ? '搜尋中' : '搜尋'}
              </Button>
            </form>
            {searchError ? <p className="text-sm text-red-700">{searchError}</p> : null}

            {searched ? (
              <div className="space-y-3">
                {results.length > 0 ? (
                  <>
                    <p className="text-sm font-medium">找到 {results.length} 家</p>
                    {results.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => chooseExisting(item)}
                        className="flex w-full items-center justify-between gap-4 rounded-2xl border-2 border-neutral-300 p-4 text-left hover:border-neutral-950"
                      >
                        <span>
                          <strong className="block">{item.name}</strong>
                          <span className="mt-1 block text-sm text-neutral-500">
                            {item.merchantId} · {item.city || item.phone || '尚無聯絡資料'}
                          </span>
                        </span>
                        <ArrowRight className="h-5 w-5 shrink-0" />
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="rounded-xl bg-neutral-100 px-4 py-3 text-sm">沒有找到相符店家。</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full border-2 border-neutral-950 bg-white"
                  onClick={chooseNew}
                >
                  <Store className="mr-2 h-4 w-4" />
                  建立「{query.trim()}」
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 'services' ? (
          <div className="space-y-6">
            <StepTitle
              title="選擇合作方式"
              description={existing ? `為「${existing.name}」開通服務，可複選。` : '可複選，之後也能再增加。'}
            />
            <div className="space-y-3">
              {MERCHANT_COOPERATION_TYPES.map((type) => {
                const selected = types.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left',
                      selected ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                        selected ? 'border-white bg-white text-neutral-950' : 'border-neutral-400',
                      )}
                    >
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <span>
                      <strong className="block">{merchantTypeLabel[type]}</strong>
                      <span className={cn('mt-1 block text-sm', selected ? 'text-neutral-300' : 'text-neutral-500')}>
                        {cooperationDescription[type]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Navigation back={back} next={() => setStep(existing ? 'confirm' : 'details')} nextDisabled={types.length === 0} />
          </div>
        ) : null}

        {step === 'details' ? (
          <div className="space-y-6">
            <StepTitle title="填寫店家資料" description="店名是主體；聯絡人是實際接洽的人。" />
            <div className="space-y-4">
              <Field label="店家名稱" required>
                <Input value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} className="h-12 border-2 border-neutral-300" />
              </Field>
              <Field label="聯絡人姓名">
                <Input value={details.contactName} onChange={(event) => setDetails({ ...details, contactName: event.target.value })} className="h-12 border-2 border-neutral-300" placeholder="例：王小明" />
              </Field>
              <Field label="電話">
                <Input type="tel" value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} className="h-12 border-2 border-neutral-300" placeholder="例：0912-345-678" />
              </Field>
              <Field label="縣市">
                <Input value={details.city} onChange={(event) => setDetails({ ...details, city: event.target.value })} className="h-12 border-2 border-neutral-300" placeholder="例：新北市" />
              </Field>
            </div>
            <Navigation back={back} next={() => setStep('confirm')} nextDisabled={!details.name.trim()} />
          </div>
        ) : null}

        {step === 'confirm' ? (
          <div className="space-y-6">
            <StepTitle title="確認店家資料" description="確認後建立店家，下一步設定 POS 帳號。" />
            <dl className="divide-y-2 divide-neutral-200 rounded-2xl border-2 border-neutral-900">
              <Summary label="店家" value={existing?.name ?? details.name} />
              <Summary label="聯絡人" value={existing ? existing.phone || '沿用原資料' : details.contactName || '未填寫'} />
              <Summary label="合作方式" value={types.map((type) => merchantTypeLabel[type]).join('、')} />
            </dl>

            <form action={existing ? activateFormAction : createFormAction}>
              {existing ? <input type="hidden" name="merchantId" value={existing.id} /> : null}
              {!existing ? (
                <>
                  <input type="hidden" name="name" value={details.name} />
                  <input type="hidden" name="contactName" value={details.contactName} />
                  <input type="hidden" name="phone" value={details.phone} />
                  <input type="hidden" name="city" value={details.city} />
                  <input type="hidden" name="preferredCarrier" value="" />
                </>
              ) : null}
              {types.map((type) => <input key={type} type="hidden" name="types" value={type} />)}
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="h-12 border-2 border-neutral-950" onClick={back}>
                  <ArrowLeft className="mr-1 h-4 w-4" />修改
                </Button>
                <SubmitButton label={existing ? '確認並繼續' : '建立並繼續'} />
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StepTitle({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-2xl font-bold tracking-tight">{title}</h2><p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p></div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}{required ? ' *' : ''}</span>{children}</label>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 px-4 py-4"><dt className="text-sm text-neutral-500">{label}</dt><dd className="text-right text-sm font-semibold">{value}</dd></div>;
}

function Navigation({ back, next, nextDisabled }: { back: () => void; next: () => void; nextDisabled?: boolean }) {
  return <div className="flex gap-3 pt-2"><Button type="button" variant="outline" className="h-12 border-2 border-neutral-950" onClick={back}><ArrowLeft className="mr-1 h-4 w-4" />上一步</Button><Button type="button" className="h-12 flex-1 bg-neutral-950 text-white" onClick={next} disabled={nextDisabled}>繼續<ArrowRight className="ml-1 h-4 w-4" /></Button></div>;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" className="h-12 flex-1 bg-neutral-950 text-white" disabled={pending}>{pending ? '處理中…' : label}<ArrowRight className="ml-1 h-4 w-4" /></Button>;
}
