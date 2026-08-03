'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { PRODUCT_UNIT_OPTIONS } from '@/lib/product-units';
import {
  platformProductCategoryLabel,
  productCategoryLabel,
} from '@/lib/labels';
import { cn } from '@/lib/utils';
import { PRODUCT_CATEGORIES } from '@/lib/product-category';

type ProductInput = {
  id?: string;
  productId?: string;
  sku?: string;
  name: string;
  category: string;
  productCategory?: string;
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
  layout = 'default',
  productType = 'simple',
}: {
  product: ProductInput;
  vendors: VendorOption[];
  saveAction: (formData: FormData) => void | Promise<void>;
  deleteAction?: (
    formData: FormData,
  ) => Promise<{ ok: true } | { ok: false; error: string }> | void | Promise<void>;
  submitLabel?: string;
  layout?: 'default' | 'studio';
  productType?: 'simple' | 'variable';
}) {
  const isEdit = Boolean(product.id);
  const studio = layout === 'studio';
  const variable = productType === 'variable';
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    if (!product.id || !deleteAction) return;
    if (
      !confirm(
        '確定要刪除此商品？\n\n刪除後無法復原，並會一併移除寄賣店庫存／分潤規則與內部庫存紀錄。\n若商品已用於正式訂單或出貨，系統會擋下並提示改為「下架」。',
      )
    ) {
      return;
    }
    setDeleteError(null);
    const fd = new FormData();
    fd.set('id', product.id);
    startDelete(async () => {
      const res = await deleteAction(fd);
      if (res && !res.ok) setDeleteError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <form action={saveAction} className={studio ? 'space-y-6' : 'space-y-4'}>
        {product.id && <input type="hidden" name="id" value={product.id} />}
        <input type="hidden" name="productType" value={productType} />
        {variable ? (
          <>
            <input type="hidden" name="price" value={product.price} />
            <input type="hidden" name="cost" value={product.cost} />
            <input type="hidden" name="unit" value={product.unit} />
          </>
        ) : null}

        <div className={studio ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}>
          {product.productId && (
            <Field label="商品編號" layout={layout}>
              <span className="font-mono text-sm text-muted-foreground">{product.productId}</span>
            </Field>
          )}
          {product.sku && (
            <Field label="SKU" layout={layout}>
              <span className="font-mono text-sm text-muted-foreground">{product.sku}</span>
            </Field>
          )}

          <Field
            label="商品名稱"
            required
            layout={layout}
            className={studio ? 'md:col-span-2' : undefined}
          >
            <Input name="name" defaultValue={product.name} required maxLength={120} />
          </Field>

          <Field label="零食分類" layout={layout}>
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

          <Field label="平台類型" layout={layout}>
            <select
              name="productCategory"
              defaultValue={product.productCategory ?? 'STANDARD'}
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PRODUCT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {platformProductCategoryLabel[value] ?? value}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              選「換罐計畫」後，店家 POS 叫貨「自己選」才會出現此商品。
            </p>
          </Field>

          <Field label="款式" layout={layout}>
            <Input
              name="style"
              defaultValue={product.style ?? ''}
              maxLength={60}
              placeholder="例：凍肉 / 蔬果"
            />
          </Field>

          {!variable ? (
            <>
              <Field label="計價單位" layout={layout}>
                <select
                  name="unit"
                  defaultValue={product.unit}
                  className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {PRODUCT_UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                  {!PRODUCT_UNIT_OPTIONS.includes(product.unit as (typeof PRODUCT_UNIT_OPTIONS)[number]) ? (
                    <option value={product.unit}>{product.unit}</option>
                  ) : null}
                </select>
              </Field>

              <Field label="基礎售價" required layout={layout}>
                <Input
                  name="price"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={product.price}
                  required
                />
              </Field>

              <Field label="成本" layout={layout}>
                <Input
                  name="cost"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={product.cost}
                />
              </Field>
            </>
          ) : null}

          <Field label="補貨點" layout={layout}>
            <Input
              name="reorderPoint"
              type="number"
              min={0}
              step={1}
              defaultValue={product.reorderPoint}
            />
          </Field>

          <Field label="廠商" layout={layout}>
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

          <Field label="狀態" layout={layout}>
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

          <Field
            label="備註"
            layout={layout}
            className={studio ? 'md:col-span-2' : undefined}
          >
            <textarea
              name="notes"
              defaultValue={product.notes ?? ''}
              rows={3}
              maxLength={1000}
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
        </div>

        <div className="flex flex-col gap-1 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          {isEdit && deleteAction ? (
            <div className="flex flex-col items-start gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={deleting}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {deleting ? '刪除中…' : '刪除'}
              </Button>
              {deleteError ? (
                <span className="max-w-md text-[11px] text-destructive">{deleteError}</span>
              ) : null}
            </div>
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
  layout = 'default',
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  layout?: 'default' | 'studio';
  className?: string;
}) {
  if (layout === 'studio') {
    return (
      <div className={cn('space-y-1.5', className)}>
        <label className="text-xs font-medium text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
        <div>{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-1.5 sm:grid-cols-[120px_1fr] sm:items-center sm:gap-4', className)}>
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
