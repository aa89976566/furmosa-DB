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

export function MerchantShippingForm({ merchant }: { merchant: MerchantShippingInput }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState<CarrierMode>(initialCarrier(merchant.preferredCarrier));

  return (
    <form
      action={async (formData) => {
        try {
          await updateMerchantShipping(formData);
          router.refresh();
        } catch (e) {
          alert(e instanceof Error ? e.message : '儲存失敗');
        }
      }}
      className="space-y-6"
    >
      <input type="hidden" name="merchantId" value={merchant.id} />
      <input type="hidden" name="preferredCarrier" value={carrier} />

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">預設物流方式</p>
        <div className="inline-flex rounded-xl border border-border/70 bg-muted/40 p-1">
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

      <div className="space-y-4 rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground">聯絡資料</p>
        <MerchantTypeFields defaultTypes={merchant.types} />
        <div className="grid gap-4 sm:grid-cols-2">
          <MerchantField label="產業">
            <select
              name="industry"
              defaultValue={merchant.industry ?? ''}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
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
            <Input name="city" defaultValue={merchant.city ?? ''} maxLength={40} placeholder="例：新北" />
          </MerchantField>
          <MerchantField label="聯絡人（取件人）">
            <Input
              name="contactName"
              defaultValue={merchant.contactName ?? ''}
              maxLength={60}
              placeholder="例：王小明"
            />
          </MerchantField>
          <MerchantField label="電話">
            <Input
              name="phone"
              type="tel"
              defaultValue={merchant.phone ?? ''}
              maxLength={40}
              placeholder="0912-345-678"
            />
          </MerchantField>
          <MerchantField label="Email" className="sm:col-span-2">
            <Input
              name="email"
              type="text"
              inputMode="email"
              defaultValue={merchant.email ?? ''}
              maxLength={120}
            />
          </MerchantField>
        </div>
      </div>

      {carrier === CARRIER_711 && (
        <div className="space-y-3 rounded-xl border border-dashed border-primary/25 bg-primary/5 p-4">
          <p className="text-sm font-medium text-navy">7-11 取件門市</p>
          <MerchantField label="門市名稱" required hint="進貨時會自動帶入「門市」欄位">
            <Input
              name="pickupStoreName"
              defaultValue={merchant.pickupStoreName ?? ''}
              maxLength={80}
              required={carrier === CARRIER_711}
              placeholder="例：淡水復興門市"
            />
          </MerchantField>
        </div>
      )}

      {carrier === '黑貓' && (
        <div className="space-y-3 rounded-xl border border-dashed border-border/80 bg-muted/30 p-4">
          <p className="text-sm font-medium text-navy">黑貓收件地址</p>
          <MerchantField label="完整地址" hint="進貨時會自動帶入收件地">
            <textarea
              name="address"
              defaultValue={merchant.address ?? ''}
              rows={3}
              maxLength={300}
              placeholder="例：新北市淡水區復興路 100 號"
              className="block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </MerchantField>
        </div>
      )}

      {carrier === '送貨' && (
        <div className="space-y-3 rounded-xl border border-dashed border-border/80 bg-muted/30 p-4">
          <p className="text-sm font-medium text-navy">送貨地址</p>
          <MerchantField label="店家地址" hint="新增訂單選「送貨」時會自動帶入">
            <textarea
              name="address"
              defaultValue={merchant.address ?? ''}
              rows={3}
              maxLength={300}
              placeholder="例：新北市淡水區…"
              className="block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </MerchantField>
        </div>
      )}

      {carrier === '' && (
        <MerchantField label="備用地址（選填）" hint="尚未指定物流時可先填">
          <Input
            name="address"
            defaultValue={merchant.address ?? ''}
            maxLength={300}
            placeholder="尚未指定物流時可先填"
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
      {pending ? '儲存中…' : '儲存運輸資料'}
    </>
  );
}
