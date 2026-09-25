'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { PRODUCT_UNIT_OPTIONS } from '@/lib/product-units';
import { productCategoryLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';

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
  defaultTemperature: string | null;
  productCategory: string;
  businessTier: string | null;
  defaultConsignmentCommissionMode: string | null;
  defaultConsignmentCommissionValue: number | null;
  defaultWholesaleUnitPrice: number | null;
  consignmentEnabled: boolean | null;
  wholesaleEnabled: boolean | null;
  jarExchangeEnabled: boolean | null;
  commercialTermsVersion: number | null;
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
  const [retailCategory, setRetailCategory] = useState(product.category);
  const [consignmentEnabled, setConsignmentEnabled] = useState(Boolean(product.consignmentEnabled));
  const [wholesaleEnabled, setWholesaleEnabled] = useState(Boolean(product.wholesaleEnabled));
  const [commissionMode, setCommissionMode] = useState<'percent' | 'amount'>(
    product.defaultConsignmentCommissionMode === 'amount' ? 'amount' : 'percent',
  );
  const commissionDisplayValue = product.defaultConsignmentCommissionValue == null
    ? ''
    : product.defaultConsignmentCommissionMode === 'percent'
      ? product.defaultConsignmentCommissionValue / 100
      : product.defaultConsignmentCommissionValue;
  const [commissionValue, setCommissionValue] = useState(String(commissionDisplayValue));
  const recommendedCommission = retailCategory === 'freeze_dried'
    ? 30
    : retailCategory === 'treats'
      ? 20
      : null;

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
        <input type="hidden" name="productCategory" value={product.productCategory} />
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

          <Field label="商品類型" layout={layout}>
            <select
              name="category"
              value={retailCategory}
              onChange={(event) => setRetailCategory(event.target.value)}
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(productCategoryLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              商品類型會提供分潤建議：肉乾／零食 20%，凍乾 30%。實際比例仍以本商品設定為準。
            </p>
          </Field>

          <Field label="口味／主要原料（選填）" layout={layout}>
            <Input
              name="style"
              defaultValue={product.style ?? ''}
              maxLength={60}
              placeholder="例：丁香魚、雞肉南瓜、牛肉"
            />
          </Field>

          <Field label="預設出貨溫層" layout={layout}>
            <select
              name="defaultTemperature"
              defaultValue={product.defaultTemperature ?? ''}
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">尚未設定</option>
              <option value="ambient">常溫</option>
              <option value="chilled">冷藏</option>
              <option value="frozen">冷凍</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Shopify 訂單依 SKU 對應商品後，會自動帶入此溫層。</p>
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

          <div className={cn('space-y-5 rounded-xl border-2 p-5', studio && 'md:col-span-2')}>
            <div>
              <h3 className="text-base font-semibold">店家合作方式與預設條件</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                可同時啟用寄賣與買斷。兩種合作方式各自保存設定，不會共用同一個價格或比例。
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-4">
              <Field label="商務等級" layout="studio">
                <select
                  name="businessTier"
                  defaultValue={product.businessTier ?? 'standard'}
                  className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="standard">一般商品</option>
                  <option value="premium">Premium Product</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  一般／Premium 是商務分級；肉乾／凍乾則是上方的商品類型，兩者用途不同。
                </p>
              </Field>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className={cn(
                'space-y-4 rounded-xl border-2 p-4',
                consignmentEnabled ? 'border-foreground bg-card' : 'border-muted bg-muted/20',
              )}>
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    name="consignmentEnabled"
                    checked={consignmentEnabled}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setConsignmentEnabled(enabled);
                      if (enabled && commissionMode === 'percent' && !commissionValue && recommendedCommission) {
                        setCommissionValue(String(recommendedCommission));
                      }
                    }}
                  />
                  啟用寄賣
                </label>
                <p className="text-xs text-muted-foreground">
                  店家售出後，依此比例取得分潤。補貨單不可逐單修改；店家例外在店家設定處管理。
                </p>
                {consignmentEnabled ? (
                  <div className="space-y-4 border-t pt-4">
                    <Field label="店家分潤計算" layout="studio">
                      <select
                        name="defaultConsignmentCommissionMode"
                        value={commissionMode}
                        onChange={(event) => {
                          const nextMode = event.target.value as 'percent' | 'amount';
                          setCommissionMode(nextMode);
                          setCommissionValue('');
                        }}
                        className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="percent">售價百分比</option>
                        <option value="amount">每件固定金額</option>
                      </select>
                    </Field>
                    <Field
                      label={commissionMode === 'percent' ? '店家分潤（%）' : '店家每件分潤（元）'}
                      layout="studio"
                    >
                      <Input
                        name="defaultConsignmentCommissionDisplayValue"
                        type="number"
                        min={commissionMode === 'percent' ? 0.01 : 1}
                        max={commissionMode === 'percent' ? 100 : undefined}
                        step={commissionMode === 'percent' ? 0.01 : 1}
                        value={commissionValue}
                        onChange={(event) => setCommissionValue(event.target.value)}
                        required
                      />
                      {commissionMode === 'percent' && recommendedCommission ? (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">
                            {retailCategory === 'freeze_dried' ? '凍乾' : '肉乾／零食'}建議 {recommendedCommission}%
                          </span>
                          <button
                            type="button"
                            className="font-medium underline underline-offset-4"
                            onClick={() => setCommissionValue(String(recommendedCommission))}
                          >
                            套用建議
                          </button>
                        </div>
                      ) : null}
                    </Field>
                  </div>
                ) : null}
              </section>

              <section className={cn(
                'space-y-4 rounded-xl border-2 p-4',
                wholesaleEnabled ? 'border-foreground bg-card' : 'border-muted bg-muted/20',
              )}>
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    name="wholesaleEnabled"
                    checked={wholesaleEnabled}
                    onChange={(event) => setWholesaleEnabled(event.target.checked)}
                  />
                  啟用買斷
                </label>
                <p className="text-xs text-muted-foreground">
                  店家以進貨價買斷商品。建立訂單時可受控覆寫，系統會保存修改原因與紀錄。
                </p>
                {wholesaleEnabled && !variable ? (
                  <div className="border-t pt-4">
                    <Field label="預設買斷進貨價（元）" layout="studio">
                      <Input
                        name="defaultWholesaleUnitPrice"
                        type="number"
                        min={1}
                        step={1}
                        defaultValue={product.defaultWholesaleUnitPrice ?? ''}
                      />
                    </Field>
                  </div>
                ) : null}
                {wholesaleEnabled && variable ? (
                  <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    此商品有多個規格；儲存主檔後，請在上方「商品規格」為每個重量／包裝分別設定買斷進貨價。
                  </p>
                ) : null}
              </section>
            </div>

            {product.productCategory === 'JAR_EXCHANGE' ? (
              <label className="flex min-h-11 items-center gap-3 rounded-xl border-2 px-4 text-sm font-semibold">
                <input
                  type="checkbox"
                  name="jarExchangeEnabled"
                  defaultChecked={Boolean(product.jarExchangeEnabled)}
                />
                啟用換罐計畫
              </label>
            ) : null}
            {product.commercialTermsVersion ? (
              <p className="text-xs text-muted-foreground">
                目前商務版本：v{product.commercialTermsVersion}
              </p>
            ) : null}
          </div>

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
