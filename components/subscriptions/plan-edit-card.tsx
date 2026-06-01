'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { updateSubscriptionPlan } from '@/app/(main)/subscriptions/plans/actions';
import { Check, Gift, Pencil, Plus, Trash2, Truck, Users, X } from 'lucide-react';

type ContentItem = { name: string; weight?: string };
type BonusItem = { name: string };

export type PlanCardData = {
  id: string;
  planCode: string;
  name: string;
  tagline: string | null;
  monthlyPrice: number;
  halfYearPrice: number | null;
  halfYearSavings: number | null;
  shipmentsPerMonth: number;
  shipDays: number[];
  contents: ContentItem[];
  bonus: BonusItem[];
  recommendedFor: string | null;
  isActive: boolean;
  subscriberCount: number;
};

let rowSeq = 0;
const nextKey = () => `row-${rowSeq++}`;

export function PlanEditCard({ plan }: { plan: PlanCardData }) {
  const [editing, setEditing] = useState(false);
  const isHot = plan.planCode === 'PLAN-STANDARD';

  if (editing) {
    return (
      <PlanEditForm plan={plan} onDone={() => setEditing(false)} />
    );
  }

  return (
    <Card
      className={`relative overflow-hidden ${isHot ? 'border-amber-500/60 shadow-md' : ''} ${plan.isActive ? '' : 'opacity-70'}`}
    >
      {isHot && (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
          嚐鮮首選
        </div>
      )}
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{plan.planCode}</p>
            <h2 className="mt-1 text-2xl font-bold">{plan.name}</h2>
            {plan.tagline && <p className="text-sm text-muted-foreground">{plan.tagline}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!plan.isActive && <Badge variant="secondary">已停用</Badge>}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setEditing(true)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              編輯
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-3xl font-bold text-primary">
            {formatCurrency(Number(plan.monthlyPrice))}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ 月</span>
          </p>
          {plan.halfYearPrice != null && (
            <p className="text-xs text-muted-foreground">
              半年付清：{formatCurrency(Number(plan.halfYearPrice))}
              {plan.halfYearSavings != null && (
                <Badge variant="success" className="ml-2">
                  現省 {formatCurrency(Number(plan.halfYearSavings))}
                </Badge>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Truck className="h-4 w-4 text-info" />
          <span>
            每月 {plan.shipmentsPerMonth} 次（{plan.shipDays.map((d) => `${d}日`).join(' / ')}）
          </span>
        </div>

        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">內容物</p>
          {plan.contents.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {plan.contents.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>
                    <span className="font-medium">{c.name}</span>
                    {c.weight && (
                      <span className="ml-1 text-xs text-muted-foreground">({c.weight})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">尚未設定內容物</p>
          )}
        </div>

        {plan.bonus.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">贈品</p>
            <ul className="space-y-1.5 text-sm">
              {plan.bonus.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Gift className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>{b.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <span>{plan.recommendedFor}</span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {plan.subscriberCount} 位訂閱中
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanEditForm({ plan, onDone }: { plan: PlanCardData; onDone: () => void }) {
  const [contents, setContents] = useState<Array<{ key: string; name: string; weight: string }>>(
    plan.contents.length > 0
      ? plan.contents.map((c) => ({ key: nextKey(), name: c.name, weight: c.weight ?? '' }))
      : [{ key: nextKey(), name: '', weight: '' }],
  );
  const [bonus, setBonus] = useState<Array<{ key: string; name: string }>>(
    plan.bonus.length > 0
      ? plan.bonus.map((b) => ({ key: nextKey(), name: b.name }))
      : [],
  );

  return (
    <Card className="relative overflow-hidden border-primary/40 shadow-md">
      <CardContent className="space-y-5 p-6">
        <form
          action={async (fd) => {
            await updateSubscriptionPlan(fd);
            onDone();
          }}
          className="space-y-5"
        >
          <input type="hidden" name="id" value={plan.id} />

          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{plan.planCode}</p>
              <p className="text-xs text-muted-foreground">編輯訂閱盒</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={plan.isActive}
                className="rounded border-input"
              />
              啟用中
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="方案名稱">
              <input name="name" required defaultValue={plan.name} className={inputCls} />
            </Field>
            <Field label="標語">
              <input name="tagline" defaultValue={plan.tagline ?? ''} className={inputCls} />
            </Field>
            <Field label="每月價格">
              <input
                name="monthlyPrice"
                type="number"
                min={0}
                step={1}
                required
                defaultValue={plan.monthlyPrice}
                className={inputCls}
              />
            </Field>
            <Field label="每月出貨次數">
              <input
                name="shipmentsPerMonth"
                type="number"
                min={1}
                step={1}
                defaultValue={plan.shipmentsPerMonth}
                className={inputCls}
              />
            </Field>
            <Field label="半年付清價（選填）">
              <input
                name="halfYearPrice"
                type="number"
                min={0}
                step={1}
                defaultValue={plan.halfYearPrice ?? ''}
                className={inputCls}
              />
            </Field>
            <Field label="半年現省（選填）">
              <input
                name="halfYearSavings"
                type="number"
                min={0}
                step={1}
                defaultValue={plan.halfYearSavings ?? ''}
                className={inputCls}
              />
            </Field>
            <Field label="出貨日（1–28，逗號分隔）">
              <input
                name="shipDays"
                defaultValue={plan.shipDays.join(', ')}
                placeholder="例：1, 15"
                className={inputCls}
              />
            </Field>
            <Field label="適合對象">
              <input
                name="recommendedFor"
                defaultValue={plan.recommendedFor ?? ''}
                className={inputCls}
              />
            </Field>
          </div>

          {/* 內容物 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">內容物</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setContents((prev) => [...prev, { key: nextKey(), name: '', weight: '' }])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                新增一項
              </Button>
            </div>
            <div className="space-y-2">
              {contents.map((row) => (
                <div key={row.key} className="rounded-md border bg-muted/30 p-2">
                  <div className="flex items-center gap-2">
                    <input
                      name="contentName"
                      defaultValue={row.name}
                      placeholder="品項名稱（例：肉乾）"
                      className={`${inputCls} min-w-0 flex-1`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
                      onClick={() => setContents((prev) => prev.filter((r) => r.key !== row.key))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <input
                    name="contentWeight"
                    defaultValue={row.weight}
                    placeholder="份量（例：每次 50g）"
                    className={`${inputCls} mt-1.5`}
                  />
                </div>
              ))}
              {contents.length === 0 && (
                <p className="text-xs text-muted-foreground">尚無內容物，點「新增一項」加入。</p>
              )}
            </div>
          </div>

          {/* 贈品 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">贈品（選填）</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBonus((prev) => [...prev, { key: nextKey(), name: '' }])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                新增贈品
              </Button>
            </div>
            <div className="space-y-2">
              {bonus.map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                  <input
                    name="bonusName"
                    defaultValue={row.name}
                    placeholder="贈品名稱"
                    className={`${inputCls} flex-1`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
                    onClick={() => setBonus((prev) => prev.filter((r) => r.key !== row.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {bonus.length === 0 && (
                <p className="text-xs text-muted-foreground">沒有贈品。</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onDone}>
              <X className="mr-1 h-4 w-4" />
              取消
            </Button>
            <SaveButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const inputCls =
  'block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Check className="mr-1 h-4 w-4" />
      {pending ? '儲存中…' : '儲存方案'}
    </Button>
  );
}
