'use client';

import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Trash2 } from 'lucide-react';
import { useRef } from 'react';

type VendorInput = {
  id?: string;
  vendorId?: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  paymentTerms: string | null;
  notes: string | null;
  status: string;
};

export function VendorForm({
  vendor,
  saveAction,
  deleteAction,
  submitLabel,
}: {
  vendor: VendorInput;
  saveAction: (formData: FormData) => void | Promise<void>;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(vendor.id);

  return (
    <div className="space-y-4">
      <form
        action={async (formData) => {
          try {
            await saveAction(formData);
            router.refresh();
          } catch (e) {
            alert(e instanceof Error ? e.message : '儲存失敗');
          }
        }}
        className="space-y-4"
      >
        {vendor.id && <input type="hidden" name="id" value={vendor.id} />}

        {vendor.vendorId && (
          <Field label="廠商編號">
            <span className="font-mono text-sm text-muted-foreground">{vendor.vendorId}</span>
          </Field>
        )}

        <Field label="名稱" required>
          <Input name="name" defaultValue={vendor.name} required maxLength={120} />
        </Field>

        <Field label="聯絡人">
          <Input name="contactName" defaultValue={vendor.contactName ?? ''} maxLength={60} />
        </Field>

        <Field label="電話">
          <Input
            name="phone"
            type="tel"
            defaultValue={vendor.phone ?? ''}
            maxLength={40}
            placeholder="例：02-2345-6789"
          />
        </Field>

        <Field label="Email">
          <Input
            name="email"
            type="text"
            inputMode="email"
            defaultValue={vendor.email ?? ''}
            maxLength={120}
            placeholder="contact@example.com（選填）"
          />
        </Field>

        <Field label="地址">
          <Input name="address" defaultValue={vendor.address ?? ''} maxLength={200} />
        </Field>

        <Field label="付款條件">
          <Input
            name="paymentTerms"
            defaultValue={vendor.paymentTerms ?? ''}
            maxLength={120}
            placeholder="例：月結 30 天"
          />
        </Field>

        <Field label="備註">
          <textarea
            name="notes"
            defaultValue={vendor.notes ?? ''}
            rows={3}
            maxLength={1000}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label="狀態">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="statusActive"
              value="1"
              defaultChecked={vendor.status === 'active'}
              className="h-4 w-4 rounded border"
            />
            啟用中
          </label>
        </Field>

        <div className="flex items-center justify-between gap-2 border-t pt-4">
          {isEdit && deleteAction ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={async () => {
                if (
                  !confirm('確定要刪除此廠商？刪除後無法復原（若仍綁定商品將無法刪除）。')
                ) {
                  return;
                }
                const fd = new FormData();
                fd.set('id', vendor.id!);
                try {
                  await deleteAction(fd);
                } catch (e) {
                  alert(e instanceof Error ? e.message : '刪除失敗');
                }
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              刪除
            </Button>
          ) : (
            <span />
          )}
          <SaveButton label={submitLabel ?? '儲存變更'} />
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[120px_1fr] sm:items-center sm:gap-4">
      <label className="text-xs text-muted-foreground sm:text-right">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <div>{children}</div>
    </div>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Save className="mr-1 h-4 w-4" />
      {pending ? '儲存中…' : label}
    </Button>
  );
}
