'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import {
  computeTierMargin,
  isGramUnit,
  resolveTierCost,
  tierCostDisplay,
  tierPricePerGram,
} from '@/lib/product-price-tier';
import { createPriceTier, updatePriceTier, deletePriceTier } from '../actions';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';

export type PriceTierRow = {
  id: string;
  weightGrams: number | null;
  unit: string;
  unitQty: number;
  price: number;
  cost: number | null;
  notes: string | null;
};

type EditState = { kind: 'none' } | { kind: 'new' } | { kind: 'edit'; id: string };

const WEIGHT_PRESETS = [30, 50, 100, 150] as const;

export function PriceTierManager({
  productId,
  productUnit,
  tiers,
}: {
  productId: string;
  productUnit: string;
  tiers: PriceTierRow[];
}) {
  const weightOnly = isGramUnit(productUnit);
  const [edit, setEdit] = useState<EditState>({ kind: 'none' });
  const [deleting, setDeleting] = useState(false);

  const existingWeights = new Set(
    tiers.map((t) => t.weightGrams).filter((w): w is number => w != null && w > 0),
  );

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`確定要刪除規格「${label}」？刪除後無法復原。`)) return;
    setDeleting(true);
    try {
      const fd = new FormData();
      fd.set('productId', productId);
      fd.set('id', id);
      await deletePriceTier(fd);
    } catch (e) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant={edit.kind === 'new' ? 'secondary' : 'default'}
          onClick={() => setEdit(edit.kind === 'new' ? { kind: 'none' } : { kind: 'new' })}
        >
          {edit.kind === 'new' ? (
            <>
              <X className="mr-1 h-4 w-4" />
              取消新增
            </>
          ) : (
            <>
              <Plus className="mr-1 h-4 w-4" />
              新增規格
            </>
          )}
        </Button>
      </div>

      {tiers.length === 0 && edit.kind !== 'new' ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          尚無規格 — 請新增各重量的售價與成本（例：30g、50g、100g）
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">{weightOnly ? '重量' : '規格'}</TableHead>
              <TableHead className="text-right">售價</TableHead>
              <TableHead className="text-right">成本</TableHead>
              {weightOnly && <TableHead className="text-right">售價 / g</TableHead>}
              <TableHead className="text-right">毛利</TableHead>
              <TableHead>備註</TableHead>
              <TableHead className="w-[140px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {edit.kind === 'new' && (
              <TierFormRow
                productId={productId}
                weightOnly={weightOnly}
                existingWeights={existingWeights}
                onCancel={() => setEdit({ kind: 'none' })}
                onSuccess={() => setEdit({ kind: 'none' })}
              />
            )}
            {tiers.map((t) => {
              if (edit.kind === 'edit' && edit.id === t.id) {
                return (
                  <TierFormRow
                    key={t.id}
                    productId={productId}
                    weightOnly={weightOnly}
                    existingWeights={existingWeights}
                    tier={t}
                    onCancel={() => setEdit({ kind: 'none' })}
                    onSuccess={() => setEdit({ kind: 'none' })}
                  />
                );
              }
              return (
                <TierDisplayRow
                  key={t.id}
                  tier={t}
                  weightOnly={weightOnly}
                  onEdit={() => setEdit({ kind: 'edit', id: t.id })}
                  onDelete={() => handleDelete(t.id, tierLabel(t))}
                  disabled={edit.kind !== 'none' || deleting}
                />
              );
            })}
          </TableBody>
        </Table>
      )}

    </div>
  );
}

function tierLabel(t: PriceTierRow): string {
  if (t.weightGrams) return `${t.weightGrams}g`;
  return `${t.unitQty} ${t.unit}`;
}

function TierDisplayRow({
  tier,
  weightOnly,
  onEdit,
  onDelete,
  disabled,
}: {
  tier: PriceTierRow;
  weightOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const label = tierLabel(tier);
  const perGram = tierPricePerGram(tier);
  const tierCost = tierCostDisplay(tier);
  const margin = computeTierMargin(tier);

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Badge variant="secondary" className="font-mono">
          {label}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">
        {formatCurrency(tier.price)}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {tierCost != null ? formatCurrency(tierCost) : '-'}
      </TableCell>
      {weightOnly && (
        <TableCell className="text-right text-xs text-muted-foreground">
          {perGram != null ? `${perGram.toFixed(2)} /g` : '-'}
        </TableCell>
      )}
      <TableCell className="text-right text-xs">
        {margin != null ? (
          <span className={margin > 0 ? 'text-success' : 'text-destructive'}>
            {formatCurrency(margin)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
        {tier.notes ?? '-'}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} disabled={disabled}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={disabled}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function TierFormRow({
  productId,
  weightOnly,
  existingWeights,
  tier,
  onCancel,
  onSuccess,
}: {
  productId: string;
  weightOnly: boolean;
  existingWeights: Set<number>;
  tier?: PriceTierRow;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const isEdit = Boolean(tier);
  const initialMode: 'weight' | 'unit' =
    weightOnly || tier == null
      ? 'weight'
      : tier.weightGrams != null
        ? 'weight'
        : 'unit';
  const [mode, setMode] = useState<'weight' | 'unit'>(initialMode);
  const [presetWeight, setPresetWeight] = useState<number | ''>(
    tier?.weightGrams ?? '',
  );
  const tierCostDefault =
    tier != null ? resolveTierCost(tier.cost, tier.weightGrams) : null;

  const colSpan = weightOnly ? 6 : 7;

  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={colSpan} className="py-3">
        <form
          action={async (formData) => {
            try {
              if (isEdit) await updatePriceTier(formData);
              else await createPriceTier(formData);
              onSuccess();
            } catch (e) {
              alert(e instanceof Error ? e.message : '儲存失敗');
            }
          }}
          className="space-y-3"
        >
          <input type="hidden" name="productId" value={productId} />
          {tier && <input type="hidden" name="id" value={tier.id} />}
          <input type="hidden" name="mode" value={mode} />

          <div className="flex flex-wrap items-end gap-3">
            {!weightOnly && (
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">計價方式</label>
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setMode('weight')}
                    className={`rounded px-3 py-1 text-xs ${
                      mode === 'weight'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    按重量
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('unit')}
                    className={`rounded px-3 py-1 text-xs ${
                      mode === 'unit'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    按單位
                  </button>
                </div>
              </div>
            )}

            {mode === 'weight' && (
              <>
                <FieldInline label="重量 (g)" required>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {WEIGHT_PRESETS.map((g) => {
                      const taken = existingWeights.has(g) && tier?.weightGrams !== g;
                      return (
                        <button
                          key={g}
                          type="button"
                          disabled={taken}
                          onClick={() => setPresetWeight(g)}
                          className={`rounded-md border px-2 py-1 text-xs ${
                            presetWeight === g
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted'
                          } ${taken ? 'cursor-not-allowed opacity-40' : ''}`}
                        >
                          {g}g
                        </button>
                      );
                    })}
                    <Input
                      name="weightGrams"
                      type="number"
                      min={1}
                      step={1}
                      value={presetWeight}
                      onChange={(e) =>
                        setPresetWeight(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="自訂"
                      required
                      autoComplete="off"
                      className="w-20"
                    />
                  </div>
                </FieldInline>
              </>
            )}

            {mode === 'unit' && (
              <>
                <FieldInline label="包裝數量" required>
                  <Input
                    name="unitQty"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={tier?.unitQty ?? 1}
                    placeholder="5"
                    required
                    className="w-20"
                  />
                </FieldInline>
                <FieldInline label="單位" required>
                  <Input
                    name="unit"
                    defaultValue={tier && tier.weightGrams == null ? tier.unit : ''}
                    placeholder="隻 / 片 / 包"
                    required
                    maxLength={10}
                    className="w-24"
                  />
                </FieldInline>
              </>
            )}

            <FieldInline label="售價 (元)" required>
              <Input
                name="price"
                type="number"
                min={0.01}
                step="0.01"
                defaultValue={tier?.price ?? ''}
                placeholder="100"
                required
                className="w-28"
              />
            </FieldInline>

            <FieldInline label="成本 (元)" required>
              <Input
                name="tierCost"
                type="number"
                min={0.01}
                step="0.01"
                defaultValue={tierCostDefault ?? ''}
                placeholder={mode === 'weight' ? '此規格進貨總成本' : '此規格成本'}
                required
                autoComplete="off"
                className="w-28"
              />
            </FieldInline>

            <FieldInline label="備註">
              <Input
                name="notes"
                defaultValue={tier?.notes ?? ''}
                maxLength={120}
                placeholder="選填"
                className="w-44"
              />
            </FieldInline>
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              取消
            </Button>
            <SaveButton label={isEdit ? '儲存變更' : '新增規格'} />
          </div>
        </form>
      </TableCell>
    </TableRow>
  );
}

function FieldInline({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
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
