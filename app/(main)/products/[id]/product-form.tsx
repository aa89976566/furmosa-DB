'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { productCategoryLabel } from '@/lib/labels';

type ProductInput = {
  id?: string;
  productId?: string;
  sku?: string;
  name: string;
  category: string;
  style: string | null;
  unit: string;
  price: number;
  cost: number;
  reorderPoint: number;
  status: string;
  vendorId: string | null;
  notes: string | null;
};

type VendorOption = { id: string; name: string; vendorId: string };

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'active', label: '上架' },
  { value: 'draft', label: '草稿' },
  { value: 'inactive', label: '下架' },
];

export function ProductForm({
  product,
  vendors,
  saveAction,
  deleteAction,
  submitLabel,
}: {
  product: ProductInput;
  vendors: VendorOption[];
  saveAction: (formData: FormData) => void | Promise<void>;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
}) {
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(product.id);

  return (
    <div className="space-y-4">
      <form action={saveAction} className="space-y-4">
        {product.id && <input type="hidden" name="id" value={product.id} />}

        {product.productId && (
          <Field label="商品編號">
            <span className="font-mono text-sm text-muted-foreground">{product.productId}</span>
          </Field>
        )}
        {product.sku && (
          <Field label="SKU">
            <span className="font-mono text-sm text-muted-foreground">{product.sku}</span>
          </Field>
        )}

        <Field label="商品名稱" required>
          <Input name="name" defaultValue={product.name} required maxLength={120} />
        </Field>

        <Field label="分類">
          <select
            name="category"
            defaultValue={product.category}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(productCategoryLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="款式">
          <Input
            name="style"
            defaultValue={product.style ?? ''}
            maxLength={60}
            placeholder="例：凍肉 / 蔬果"
          />
        </Field>

        <Field label="計價單位">
          <Input
            name="unit"
            defaultValue={product.unit}
            maxLength={20}
            placeholder="例：件 / 包 / 隻 / 片 / g"
          />
        </Field>

        <Field label="基礎售價" required>
          <Input
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={product.price}
            required
          />
        </Field>

        <Field label="成本">
          <Input
            name="cost"
            type="number"
            min={0}
            step="0.01"
            defaultValue={product.cost}
          />
        </Field>

        <Field label="補貨點">
          <Input
            name="reorderPoint"
            type="number"
            min={0}
            step={1}
            defaultValue={product.reorderPoint}
          />
        </Field>

        <Field label="廠商">
          <select
            name="vendorId"
            defaultValue={product.vendorId ?? ''}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— 未指定 —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.vendorId})
              </option>
            ))}
          </select>
        </Field>

        <Field label="狀態">
          <select
            name="status"
            defaultValue={product.status}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="備註">
          <textarea
            name="notes"
            defaultValue={product.notes ?? ''}
            rows={3}
            maxLength={1000}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <div className="flex items-center justify-between gap-2 border-t pt-4">
          {isEdit && deleteAction ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (
                  confirm(
                    '確定要刪除此商品？\n\n刪除後無法復原。若商品已有訂單／庫存／寄賣紀錄，系統會擋下並提示改為「下架」。',
                  )
                ) {
                  deleteFormRef.current?.requestSubmit();
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

      {isEdit && deleteAction && (
        <form ref={deleteFormRef} action={deleteAction} className="hidden">
          <input type="hidden" name="id" value={product.id} />
        </form>
      )}
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
