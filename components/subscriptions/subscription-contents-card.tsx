'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { updateSubscriptionContents } from '@/app/(main)/subscriptions/[id]/actions';
import { Check, Gift, Pencil, Plus, RotateCcw, Trash2, Truck, X } from 'lucide-react';

type ContentItem = { name: string; weight?: string };
type BonusItem = { name: string };

export type SubscriptionContentsData = {
  subscriptionId: string;
  planCode: string;
  planName: string;
  tagline: string | null;
  monthlyPrice: number;
  billingCycle: string;
  halfYearPrice: number | null;
  halfYearSavings: number | null;
  shipmentsPerMonth: number;
  shipDays: number[];
  contents: ContentItem[];
  bonus: BonusItem[];
  isCustom: boolean;
};

let seq = 0;
const nextKey = () => `c-${seq++}`;

export function SubscriptionContentsCard({ data }: { data: SubscriptionContentsData }) {
  const [editing, setEditing] = useState(false);

  const header = (
    <div className="min-w-0 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{data.planCode}</p>
          <h3 className="break-words text-xl font-bold">{data.planName}</h3>
          {data.tagline && <p className="text-xs text-muted-foreground">{data.tagline}</p>}
        </div>
        {data.isCustom && <Badge variant="warning" className="shrink-0">此盒已客製</Badge>}
      </div>
      <div className="text-2xl font-bold text-primary">
        {formatCurrency(Number(data.monthlyPrice))}
        <span className="ml-1 text-sm font-normal text-muted-foreground">/ 月</span>
      </div>
      {data.billingCycle === 'halfyear' && data.halfYearPrice != null && (
        <Badge variant="success">
          半年付清 {formatCurrency(Number(data.halfYearPrice))}
          {data.halfYearSavings != null && <> · 省 {formatCurrency(Number(data.halfYearSavings))}</>}
        </Badge>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Truck className="h-4 w-4 shrink-0 text-info" />
        <span className="min-w-0 break-words">
          每月 {data.shipmentsPerMonth} 次（{data.shipDays.map((d) => `${d}日`).join(' / ')}）
        </span>
      </div>
    </div>
  );

  if (editing) {
    return <ContentsEditForm data={data} header={header} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="min-w-0 space-y-3">
      {header}
      <div className="min-w-0 space-y-1 border-t pt-3 text-sm">
        {data.contents.map((c, i) => (
          <div key={i} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span className="min-w-0 break-words">
              <span className="font-medium">{c.name}</span>
              {c.weight && <span className="ml-1 text-xs text-muted-foreground">({c.weight})</span>}
            </span>
          </div>
        ))}
        {data.bonus.map((b, i) => (
          <div key={`b-${i}`} className="flex items-start gap-2">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span className="min-w-0 break-words">{b.name}</span>
          </div>
        ))}
        {data.contents.length === 0 && data.bonus.length === 0 && (
          <p className="text-xs text-muted-foreground">尚未設定內容物</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil className="mr-1 h-4 w-4" />
          編輯內容物
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/subscriptions/plans">查看所有方案</Link>
        </Button>
      </div>
    </div>
  );
}

function ContentsEditForm({
  data,
  header,
  onDone,
}: {
  data: SubscriptionContentsData;
  header: React.ReactNode;
  onDone: () => void;
}) {
  const [contents, setContents] = useState<Array<{ key: string; name: string; weight: string }>>(
    data.contents.length > 0
      ? data.contents.map((c) => ({ key: nextKey(), name: c.name, weight: c.weight ?? '' }))
      : [{ key: nextKey(), name: '', weight: '' }],
  );
  const [bonus, setBonus] = useState<Array<{ key: string; name: string }>>(
    data.bonus.map((b) => ({ key: nextKey(), name: b.name })),
  );

  return (
    <form
      action={async (fd) => {
        await updateSubscriptionContents(fd);
        onDone();
      }}
      className="min-w-0 space-y-3"
    >
      <input type="hidden" name="subscriptionId" value={data.subscriptionId} />
      {header}

      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-muted-foreground">內容物</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setContents((p) => [...p, { key: nextKey(), name: '', weight: '' }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            新增
          </Button>
        </div>
        {contents.map((row) => (
          <div key={row.key} className="rounded-md border bg-muted/30 p-2">
            <div className="flex items-center gap-2">
              <input
                name="contentName"
                defaultValue={row.name}
                placeholder="品項名稱（例：雞肉南瓜乾）"
                className={`${inputCls} min-w-0 flex-1`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => setContents((p) => p.filter((r) => r.key !== row.key))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <input
              name="contentWeight"
              defaultValue={row.weight}
              placeholder="份量（例：50g）"
              className={`${inputCls} mt-1.5`}
            />
          </div>
        ))}
        {contents.length === 0 && (
          <p className="text-xs text-muted-foreground">尚無內容物，點「新增」加入。</p>
        )}
      </div>

      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-muted-foreground">贈品（選填）</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBonus((p) => [...p, { key: nextKey(), name: '' }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            新增
          </Button>
        </div>
        {bonus.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <input
              name="bonusName"
              defaultValue={row.name}
              placeholder="贈品名稱"
              className={`${inputCls} min-w-0 flex-1`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
              onClick={() => setBonus((p) => p.filter((r) => r.key !== row.key))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {bonus.length === 0 && <p className="text-xs text-muted-foreground">沒有贈品。</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        {data.isCustom ? (
          <ResetButton subscriptionId={data.subscriptionId} onDone={onDone} />
        ) : (
          <span className="text-[11px] text-muted-foreground">儲存後僅影響此訂閱</span>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDone}>
            <X className="mr-1 h-4 w-4" />
            取消
          </Button>
          <SaveButton />
        </div>
      </div>
    </form>
  );
}

function ResetButton({ subscriptionId, onDone }: { subscriptionId: string; onDone: () => void }) {
  return (
    <form
      action={async (fd) => {
        await updateSubscriptionContents(fd);
        onDone();
      }}
    >
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="reset" value="on" />
      <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        恢復方案預設
      </Button>
    </form>
  );
}

const inputCls =
  'block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Check className="mr-1 h-4 w-4" />
      {pending ? '儲存中…' : '儲存'}
    </Button>
  );
}
