'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';
import { CARRIER_711 } from '@/lib/carrier-cvs';
import { updateMerchantShipping } from '@/app/(main)/merchants/[id]/actions';
import { merchantIndustryLabel } from '@/lib/labels';
import { MerchantTypeFields } from '@/components/merchants/merchant-type-fields';
import { MerchantField, MerchantFormActions } from '@/components/merchants/merchant-ui';
import type { MerchantType } from '@/lib/merchant-types';
import { cn } from '@/lib/utils';

export type MerchantShippingInput = {
  id: string;
  types: MerchantType[];
  industry: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  preferredCarrier: string | null;
  pickupStoreName: string | null;
};

type CarrierMode = '' | typeof CARRIER_711 | '黑貓' | '送貨';

function initialCarrier(value: string | null | undefined): CarrierMode {
  const v = (value ?? '').trim();
  if (v === CARRIER_711 || v === '黑貓' || v === '送貨') return v;
  return '';
}

export function MerchantShippingForm({
  merchant,
  compact = false,
  onSaved,
}: {
  merchant: MerchantShippingInput;
  compact?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [carrier, setCarrier] = useState<CarrierMode>(initialCarrier(merchant.preferredCarrier));

  return (
    <form
      action={async (formData) => {
        try {
          await updateMerchantShipping(formData);
          router.refresh();
          onSaved?.();
        } catch (e) {
          alert(e instanceof Error ? e.message : '儲存失敗');
        }
      }}
      className={cn('space-y-4', !compact && 'space-y-6')}
    >
      <input type="hidden" name="merchantId" value={merchant.id} />
      <input type="hidden" name="preferredCarrier" value={carrier} />

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">預設物流</p>
        <div className="inline-flex flex-wrap rounded-lg border border-border/70 bg-muted/40 p-0.5">
          {(
            [
              ['', '未設定'],
              [CARRIER_711, '7-11'],
              ['黑貓', '黑貓'],
              ['送貨', '送貨'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key || 'none'}
              type="button"
              onClick={() => setCarrier(key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                carrier === key
                  ? 'bg-surface-raised text-navy shadow-sm'
                  : 'text-muted-foreground hover:text-navy',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('space-y-3', !compact && 'rounded-xl border border-border/60 bg-muted/30 p-4')}>
        {!compact ? (
          <p className="text-xs font-medium text-muted-foreground">聯絡資料</p>
        ) : null}
        <MerchantTypeFields defaultTypes={merchant.types} />
        <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'gap-4 sm:grid-cols-2')}>
          <MerchantField label="產業">
            <select
              name="industry"
              defaultValue={merchant.industry ?? ''}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">未設定</option>
              {Object.entries(merchantIndustryLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </MerchantField>
          <MerchantField label="城市">
            <Input
              name="city"
              defaultValue={merchant.city ?? ''}
              maxLength={40}
              placeholder="例：新北"
              className="h-9"
            />
          </MerchantField>
          <MerchantField label="聯絡人">
            <Input
              name="contactName"
              defaultValue={merchant.contactName ?? ''}
              maxLength={60}
              placeholder="例：王小明"
              className="h-9"
            />
          </MerchantField>
          <MerchantField label="電話">
            <Input
              name="phone"
              type="tel"
              defaultValue={merchant.phone ?? ''}
              maxLength={40}
              placeholder="0912-345-678"
              className="h-9"
            />
          </MerchantField>
          <MerchantField label="Email" className={compact ? undefined : 'sm:col-span-2'}>
            <Input
              name="email"
              type="text"
              inputMode="email"
              defaultValue={merchant.email ?? ''}
              maxLength={120}
              className="h-9"
            />
          </MerchantField>
        </div>
      </div>

      {carrier === CARRIER_711 && (
        <MerchantField label="7-11 門市" required hint="進貨時自動帶入">
          <Input
            name="pickupStoreName"
            defaultValue={merchant.pickupStoreName ?? ''}
            maxLength={80}
            required={carrier === CARRIER_711}
            placeholder="例：淡水復興門市"
            className="h-9"
          />
        </MerchantField>
      )}

      {carrier === '黑貓' && (
        <MerchantField label="黑貓收件地址" hint="進貨時自動帶入">
          <textarea
            name="address"
            defaultValue={merchant.address ?? ''}
            rows={compact ? 2 : 3}
            maxLength={300}
            placeholder="例：新北市淡水區復興路 100 號"
            className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </MerchantField>
      )}

      {carrier === '送貨' && (
        <MerchantField label="送貨地址" hint="新增訂單選送貨時自動帶入">
          <textarea
            name="address"
            defaultValue={merchant.address ?? ''}
            rows={compact ? 2 : 3}
            maxLength={300}
            placeholder="例：新北市淡水區…"
            className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </MerchantField>
      )}

      {carrier === '' && (
        <MerchantField label="備用地址（選填）">
          <Input
            name="address"
            defaultValue={merchant.address ?? ''}
            maxLength={300}
            placeholder="尚未指定物流時可先填"
            className="h-9"
          />
        </MerchantField>
      )}

      <MerchantFormActions className="border-t-0 pt-0">
        <Button type="submit" size="sm">
          <SubmitLabel />
        </Button>
      </MerchantFormActions>
    </form>
  );
}

function SubmitLabel() {
  const { pending } = useFormStatus();
  return (
    <>
      <Save className="mr-1 h-4 w-4" />
      {pending ? '儲存中…' : '儲存'}
    </>
  );
}
