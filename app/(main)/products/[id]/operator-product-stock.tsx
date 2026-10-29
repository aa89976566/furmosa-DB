'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, History, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { saveInventoryQuantities } from '../../inventory/quantity-actions';

type SellingTier = {
  id: string;
  label: string;
  price: string;
};

export function OperatorProductStock({
  productId,
  productName,
  sku,
  quantity,
  unit,
  expectedVersion,
  canCount,
  blockedReason,
  lastCountedAt,
  tiers,
}: {
  productId: string;
  productName: string;
  sku: string;
  quantity: number | null;
  unit: string | null;
  expectedVersion: string | null;
  canCount: boolean;
  blockedReason?: string;
  lastCountedAt: string | null;
  tiers: SellingTier[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nextQuantity, setNextQuantity] = useState(quantity == null ? '' : String(quantity));
  const [reason, setReason] = useState('實體盤點');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const eventKey = useRef(crypto.randomUUID());
  const parsedQuantity = Number(nextQuantity);
  const quantityValid = /^\d+$/.test(nextQuantity.trim()) && Number.isSafeInteger(parsedQuantity);
  const unchanged = quantity !== null && parsedQuantity === quantity;
  const status = quantity == null ? '待設定' : quantity <= 0 ? '需要盤點' : '庫存正常';
  const statusClass = quantity == null || quantity <= 0
    ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';

  function submit() {
    if (!canCount || pending || !quantityValid || unchanged || !reason.trim()) return;
    const form = new FormData();
    form.set('eventKey', eventKey.current);
    form.set('reason', reason.trim());
    form.set('lines', JSON.stringify([{
      productId,
      quantity: nextQuantity.trim(),
      expectedVersion,
    }]));
    setMessage(null);
    startTransition(async () => {
      const result = await saveInventoryQuantities(form);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) {
        eventKey.current = crypto.randomUUID();
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">商品庫存</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{productName}</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">{sku}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/inventory">返回庫存列表</Link>
        </Button>
      </div>

      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end lg:p-10">
          <div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <PackageCheck className="h-5 w-5" />
              <span>HQ 主倉目前庫存</span>
            </div>
            <p className="mt-4 text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl">
              {quantity == null ? '—' : quantity.toLocaleString('zh-TW')}
              <span className="ml-3 text-2xl font-medium text-muted-foreground">{unit ?? ''}</span>
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusClass}`}>{status}</span>
              <span className="text-sm text-muted-foreground">
                {lastCountedAt ? `上次盤點 ${new Date(lastCountedAt).toLocaleDateString('zh-TW')}` : '尚無盤點紀錄'}
              </span>
            </div>
          </div>

          <Dialog open={open} onOpenChange={(value) => {
            setOpen(value);
            if (value) {
              setNextQuantity(quantity == null ? '' : String(quantity));
              setMessage(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button size="lg" disabled={!canCount} className="min-h-12 w-full px-7 lg:w-auto">
                <ClipboardCheck className="mr-2 h-5 w-5" />
                調整庫存
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>更新實際庫存</DialogTitle>
                <DialogDescription>只填現場剩餘的總克數。30g、50g 是販售規格，不需要分開盤點。</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-2">
                <label className="block text-sm font-medium">
                  現場實際剩餘
                  <div className="mt-2 flex items-center gap-3">
                    <Input
                      autoFocus
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={nextQuantity}
                      onChange={(event) => setNextQuantity(event.target.value)}
                      className="h-14 text-right text-2xl tabular-nums"
                      aria-describedby="stock-unit"
                    />
                    <span id="stock-unit" className="text-lg text-muted-foreground">{unit ?? 'g'}</span>
                  </div>
                </label>
                <label className="block text-sm font-medium">
                  調整原因
                  <Input className="mt-2" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
                </label>
                {quantityValid && quantity !== null && !unchanged ? (
                  <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
                    {quantity.toLocaleString('zh-TW')} → <strong>{parsedQuantity.toLocaleString('zh-TW')} {unit}</strong>
                    <span className="ml-2 text-muted-foreground">差異 {parsedQuantity > quantity ? '+' : ''}{(parsedQuantity - quantity).toLocaleString('zh-TW')}</span>
                  </p>
                ) : null}
                {message ? <p role="alert" className={message.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'}>{message.text}</p> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>取消</Button>
                <Button onClick={submit} disabled={pending || !quantityValid || unchanged || !reason.trim()}>
                  {pending ? '儲存中…' : '確認更新'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {!canCount ? (
          <p className="border-t bg-amber-50 px-6 py-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100 sm:px-8 lg:px-10">
            {blockedReason ?? '目前無法調整此商品庫存，請由管理員完成商品設定。'}
          </p>
        ) : null}
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <details className="rounded-2xl border bg-card px-5 py-4">
          <summary className="cursor-pointer font-medium">查看販售規格 <span className="ml-2 text-sm font-normal text-muted-foreground">不影響庫存操作</span></summary>
          <div className="mt-4 divide-y text-sm">
            {tiers.length ? tiers.map((tier) => (
              <div key={tier.id} className="flex items-center justify-between gap-4 py-3">
                <span>{tier.label}</span><span className="font-medium">{tier.price}</span>
              </div>
            )) : <p className="py-3 text-muted-foreground">尚未設定販售規格</p>}
          </div>
        </details>
        <Link href={`/inventory/transactions?product=${encodeURIComponent(productId)}`} className="flex min-h-16 items-center justify-between rounded-2xl border bg-card px-5 py-4 font-medium hover:bg-muted/30">
          <span className="flex items-center gap-3"><History className="h-5 w-5 text-muted-foreground" />查看庫存異動紀錄</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </main>
  );
}
