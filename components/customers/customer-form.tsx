'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';
import { createCustomerFromForm } from '@/app/(main)/customers/actions';

type ShippingPref = '' | 'home' | 'convenience';

export function CustomerForm() {
  const [shipping, setShipping] = useState<ShippingPref>('');

  return (
    <form
      action={async (formData) => {
        try {
          await createCustomerFromForm(formData);
        } catch (e) {
          alert(e instanceof Error ? e.message : '建立失敗');
        }
      }}
      className="max-w-2xl space-y-6"
    >
      <input type="hidden" name="preferredShippingMethod" value={shipping} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="姓名" required className="sm:col-span-2">
          <Input name="name" required maxLength={60} placeholder="王小明" />
        </Field>
        <Field label="類型">
          <select
            name="type"
            defaultValue="individual"
            className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
          >
            <option value="individual">個人</option>
            <option value="business">企業</option>
          </select>
        </Field>
        <Field label="電話">
          <Input name="phone" type="tel" maxLength={40} placeholder="0912-345-678" />
        </Field>
        <Field label="Email">
          <Input name="email" type="text" inputMode="email" maxLength={120} placeholder="選填" />
        </Field>
        <Field label="LINE 顯示名稱" className="sm:col-span-2">
          <Input name="lineDisplay" maxLength={60} placeholder="選填" />
        </Field>
      </div>

      <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-medium">預設運輸方式（選填）</p>
        <div className="inline-flex rounded-md border bg-background p-0.5">
          {(
            [
              ['', '不設定'],
              ['home', '宅配'],
              ['convenience', '超商取貨'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key || 'none'}
              type="button"
              onClick={() => setShipping(key)}
              className={`rounded px-3 py-1.5 text-xs ${
                shipping === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {shipping === 'home' && (
          <Field label="宅配地址">
            <Input name="address" maxLength={200} placeholder="之後下單會自動帶入" />
          </Field>
        )}
        {shipping === 'convenience' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="超商">
              <select
                name="preferredCvsBrand"
                defaultValue=""
                className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
              >
                <option value="">請選擇</option>
                <option value="711">7-ELEVEN</option>
                <option value="familymart">全家</option>
                <option value="hilife">萊爾富</option>
              </select>
            </Field>
            <Field label="店號">
              <Input name="preferredCvsStoreId" maxLength={20} />
            </Field>
            <Field label="店名">
              <Input name="preferredCvsStoreName" maxLength={80} />
            </Field>
          </div>
        )}
        {shipping === '' && (
          <Field label="聯絡地址（選填）">
            <Input name="address" maxLength={200} />
          </Field>
        )}
      </div>

      <div className="flex justify-end border-t pt-4">
        <SubmitButton />
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="mr-1 h-4 w-4" />
      {pending ? '建立中…' : '建立客戶'}
    </Button>
  );
}
