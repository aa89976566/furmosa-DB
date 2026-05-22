'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';
import {
  createMerchantAction,
  type CreateMerchantState,
} from '@/app/(main)/merchants/create-merchant-action';
import { CARRIER_711 } from '@/lib/carrier-cvs';
import { merchantTypeLabel } from '@/lib/labels';
import {
  MerchantField,
  MerchantFormActions,
  MerchantSection,
} from '@/components/merchants/merchant-ui';

type CarrierMode = '' | typeof CARRIER_711 | '黑貓';

const initialState: CreateMerchantState = { error: null };

export function MerchantCreateForm() {
  const [carrier, setCarrier] = useState<CarrierMode>('');
  const [state, formAction] = useFormState(createMerchantAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="preferredCarrier" value={carrier} />

      {state.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <MerchantSection
        step={1}
        title="基本資料"
        description="店家名稱與類型；編號 MER-XXXX 會自動產生。"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <MerchantField label="店家名稱" required className="sm:col-span-2">
            <Input name="name" required maxLength={120} placeholder="例：淡水妞妞" />
          </MerchantField>
          <MerchantField label="類型">
            <select
              name="type"
              defaultValue="consignment"
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {Object.entries(merchantTypeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </MerchantField>
          <MerchantField label="城市">
            <Input name="city" maxLength={40} placeholder="例：新北" />
          </MerchantField>
        </div>
      </MerchantSection>

      <MerchantSection
        step={2}
        title="運輸與地址"
        description="建立後進貨會自動帶入；寄賣分潤請至「商品與庫存」設定。"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">預設物流方式</p>
            <div className="inline-flex rounded-xl border border-border/70 bg-muted/40 p-1">
              {(
                [
                  ['', '未設定'],
                  [CARRIER_711, '7-11'],
                  ['黑貓', '黑貓'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key || 'none'}
                  type="button"
                  onClick={() => setCarrier(key)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    carrier === key
                      ? 'bg-surface-raised text-navy shadow-card'
                      : 'text-muted-foreground hover:text-navy'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MerchantField label="聯絡人（取件人）">
              <Input name="contactName" maxLength={60} placeholder="例：王小明" />
            </MerchantField>
            <MerchantField label="電話">
              <Input name="phone" type="tel" maxLength={40} placeholder="0912-345-678" />
            </MerchantField>
            <MerchantField label="Email" className="sm:col-span-2">
              <Input name="email" type="text" inputMode="email" maxLength={120} />
            </MerchantField>
          </div>

          {carrier === CARRIER_711 && (
            <MerchantField label="7-11 門市名稱" required>
              <Input
                name="pickupStoreName"
                required
                maxLength={80}
                placeholder="例：淡水復興門市"
              />
            </MerchantField>
          )}

          {carrier === '黑貓' && (
            <MerchantField label="黑貓收件地址" required>
              <textarea
                name="address"
                required
                rows={3}
                maxLength={300}
                placeholder="完整收件地址"
                className="block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </MerchantField>
          )}

          {carrier === '' && (
            <MerchantField label="備用地址（選填）">
              <Input name="address" maxLength={300} />
            </MerchantField>
          )}
        </div>
      </MerchantSection>

      <MerchantSection step={3} title="其他" description="選填備註。">
        <MerchantField label="備註（選填）">
          <textarea
            name="notes"
            rows={2}
            maxLength={500}
            className="block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </MerchantField>
        <MerchantFormActions>
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
      {pending ? '建立中…' : '建立店家'}
    </Button>
  );
}
