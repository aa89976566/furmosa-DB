'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, Save } from 'lucide-react';
import { createCustomerFromForm, updateCustomerFromForm } from '@/app/(main)/customers/actions';
import {
  PetProfileFieldsBlock,
  type PetFieldDefaults,
} from '@/components/customers/pet-profile-fields-block';

type ShippingPref = '' | 'home' | 'convenience';

export type CustomerFormDefaults = {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  lineUserId: string | null;
  lineDisplay: string | null;
  preferredShippingMethod: string | null;
  preferredCvsBrand: string | null;
  preferredCvsStoreId: string | null;
  preferredCvsStoreName: string | null;
  pet: PetFieldDefaults;
};

export function CustomerForm({ customer }: { customer?: CustomerFormDefaults }) {
  const isEdit = Boolean(customer);
  const initialShipping: ShippingPref =
    customer?.preferredShippingMethod === 'home'
      ? 'home'
      : customer?.preferredShippingMethod === 'convenience'
        ? 'convenience'
        : '';
  const [shipping, setShipping] = useState<ShippingPref>(initialShipping);

  return (
    <form
      action={async (formData) => {
        try {
          if (isEdit && customer) {
            await updateCustomerFromForm(customer.id, formData);
          } else {
            await createCustomerFromForm(formData);
          }
        } catch (e) {
          alert(e instanceof Error ? e.message : isEdit ? '更新失敗' : '建立失敗');
        }
      }}
      className="max-w-2xl space-y-6"
    >
      <input type="hidden" name="preferredShippingMethod" value={shipping} />
      {!isEdit ? <input type="hidden" name="type" value="individual" /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="客戶姓名" required className="sm:col-span-2">
          <Input name="name" required maxLength={60} placeholder="王小明" defaultValue={customer?.name ?? ''} />
        </Field>
        {isEdit ? <Field label="類型">
          <select
            name="type"
            defaultValue={customer?.type ?? 'individual'}
            className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
          >
            <option value="individual">個人</option>
            <option value="business">企業</option>
          </select>
        </Field> : null}
        <Field label="電話" required={!isEdit}>
          <Input name="phone" type="tel" required={!isEdit} maxLength={40} placeholder="0912-345-678" defaultValue={customer?.phone ?? ''} />
        </Field>
        <Field label="Email">
          <Input name="email" type="text" inputMode="email" maxLength={120} placeholder="選填" defaultValue={customer?.email ?? ''} />
        </Field>
      </div>

      <OptionalSection title="LINE 資料" open={isEdit}>
        <div className="grid gap-4 sm:grid-cols-2">
        <Field label="LINE User ID" className="sm:col-span-2">
          <Input
            name="lineUserId"
            maxLength={40}
            placeholder="選填，例：Uxxxxxxxx（Messaging API 的 userId）"
            className="font-mono text-sm"
            defaultValue={customer?.lineUserId ?? ''}
          />
        </Field>
        <Field label="LINE 顯示名稱" className="sm:col-span-2">
          <Input name="lineDisplay" maxLength={60} placeholder="選填" defaultValue={customer?.lineDisplay ?? ''} />
        </Field>
        </div>
      </OptionalSection>

      <OptionalSection title="常用收貨方式" open={isEdit}>
        <p className="mb-3 text-xs text-muted-foreground">新增訂單時自動帶入，當次仍可修改。</p>
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
            <Input name="address" maxLength={200} placeholder="之後下單會自動帶入" defaultValue={customer?.address ?? ''} />
          </Field>
        )}
        {shipping === 'convenience' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="超商">
              <select
                name="preferredCvsBrand"
                defaultValue={customer?.preferredCvsBrand ?? ''}
                className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
              >
                <option value="">請選擇</option>
                <option value="711">7-ELEVEN</option>
                <option value="familymart">全家</option>
                <option value="hilife">萊爾富</option>
              </select>
            </Field>
            <Field label="店號">
              <Input name="preferredCvsStoreId" maxLength={20} defaultValue={customer?.preferredCvsStoreId ?? ''} />
            </Field>
            <Field label="店名">
              <Input name="preferredCvsStoreName" maxLength={80} defaultValue={customer?.preferredCvsStoreName ?? ''} />
            </Field>
          </div>
        )}
        {shipping === '' && (
          <Field label="聯絡地址（選填）">
            <Input name="address" maxLength={200} defaultValue={customer?.address ?? ''} />
          </Field>
        )}
      </OptionalSection>

      <OptionalSection title="毛孩資料" open={isEdit}>
        <PetProfileFieldsBlock defaults={customer?.pet} />
      </OptionalSection>

      <div className="flex justify-end border-t pt-4">
        <SubmitButton isEdit={isEdit} />
      </div>
    </form>
  );
}

function OptionalSection({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-xl border bg-muted/10">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
        <span>{title} <span className="font-normal text-muted-foreground">（選填）</span></span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
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

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="mr-1 h-4 w-4" />
      {pending ? (isEdit ? '儲存中…' : '建立中…') : isEdit ? '儲存變更' : '建立客戶'}
    </Button>
  );
}
