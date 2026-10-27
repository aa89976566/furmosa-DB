'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inventoryGroup, parseCountQuantity, type InventoryRow } from '@/lib/inventory/workbench';
import { saveInventoryQuantities } from './quantity-actions';

const number = (value: number) => value.toLocaleString('zh-TW');
const selectClass = 'min-h-11 min-w-0 rounded-lg border bg-background px-3 text-base text-foreground';
export function InventoryWorkbench({ rows, canEdit, canVerifyUnits = false, initialQuery = '' }: {
  rows: InventoryRow[]; canEdit: boolean; canVerifyUnits?: boolean; initialQuery?: string;
}) {
  const router = useRouter();
  const [q, setQuery] = useState(initialQuery), [group, setGroup] = useState('all'), [vendor, setVendor] = useState('all');
  const [editing, setEditing] = useState(false);
  const [snapshot, setSnapshot] = useState<InventoryRow[]>(rows);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition(), [refreshing, refreshTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const acknowledge = useRef<HTMLButtonElement>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const eventKey = useRef('');
  const submitting = useRef(false);
  const blocked = pending || refreshing || refreshFailed;
  const activeRows = editing ? snapshot : rows;
  const suppliers = useMemo(() => [...new Map(rows.filter(r => r.vendorId).map(r => [r.vendorId!, r.vendorName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-TW')), [rows]);
  const setupRows = rows.filter(row => row.canConfirmUnit);
  const filtered = activeRows.filter(row => (group === 'all' || inventoryGroup(row) === group) &&
    (vendor === 'all' || (vendor === 'unknown' ? !row.vendorId : row.vendorId === vendor)) &&
    `${row.name} ${row.sku} ${row.hqSku} ${row.productCode} ${row.vendorName}`.toLowerCase().includes(q.trim().toLowerCase()));
  const changes: { row: InventoryRow; quantity: number }[] = [];
  let error = '';
  for (const row of activeRows) {
    const raw = draft[row.id];
    if (raw === undefined || raw.trim() === '') continue;
    try {
      const quantity = parseCountQuantity(raw);
      if (quantity !== row.quantity && row.canCount) changes.push({ row, quantity });
    } catch { error = `${row.name}：請輸入 0 以上的整數`; }
  }
  if (changes.length > 100) error = '每次最多更新 100 項商品，請分批盤點';
  const hasDraft = editing && Object.values(draft).some(value => value.trim() !== '');

  useEffect(() => {
    if (message && !message.ok) {
      if (!dialog.current?.open) dialog.current?.showModal();
      acknowledge.current?.focus();
    }
  }, [message]);

  // Read-only background updates stop for the entire count session, preserving its version baseline.
  useEffect(() => {
    if (editing || blocked) return;
    const refresh = () => { if (document.visibilityState === 'visible') refreshTransition(() => {
      try { router.refresh(); } catch {
        setRefreshFailed(true);
        setMessage({ ok: false, text: '畫面無法更新，請重新載入後再開始盤點。' });
      }
    }); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [editing, blocked, router]);
  useEffect(() => {
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft]);

  function begin() {
    setSnapshot(rows); eventKey.current = crypto.randomUUID(); setMessage(null); setDraft({}); setEditing(true);
  }
  function cancel() {
    if (hasDraft && !window.confirm('放棄這次尚未儲存的盤點數量？')) return;
    setDraft({}); setEditing(false); setMessage(null);
  }
  function save() {
    if (blocked || submitting.current || !changes.length || error) return;
    submitting.current = true;
    const form = new FormData();
    form.set('eventKey', eventKey.current);
    form.set('reason', '例行實體盤點');
    form.set('lines', JSON.stringify(changes.map(({ row, quantity }) => ({ productId: row.id, quantity: String(quantity), expectedVersion: row.version }))));
    startTransition(async () => {
      try {
        const result = await saveInventoryQuantities(form);
        setMessage({ ok: result.ok, text: result.message });
        if (result.ok) {
          setDraft({}); setEditing(false);
          refreshTransition(() => {
            try { router.refresh(); } catch {
              setRefreshFailed(true);
              setMessage({ ok: true, text: '盤點已儲存；畫面更新失敗，請重新載入確認最新庫存。' });
            }
          });
        }
      } catch {
        setMessage({ ok: false, text: '連線中斷，請重新整理確認是否已儲存，再決定是否重試' });
      } finally { submitting.current = false; }
    });
  }

  return <section aria-label="庫存工作台" className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">{editing ? '盤點庫存' : 'HQ 主倉目前庫存'}</h2><p className="mt-1 text-sm text-muted-foreground">{editing ? '填現場剩餘總量；空白不更動，填 0 表示歸零。' : '查看目前剩餘量；點商品可查規格、各倉庫及異動。'}</p></div>
      {canEdit && !editing ? <Button onClick={begin} disabled={blocked} variant="outline" className="min-h-11"><ClipboardCheck className="mr-2 h-4 w-4"/>盤點庫存</Button> : null}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_160px_200px]">
      <div className="relative sm:col-span-2 lg:col-span-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><Input aria-label="搜尋商品或廠商" value={q} onChange={e => setQuery(e.target.value)} placeholder="搜尋商品、SKU 或廠商" className="min-h-11 pl-10 text-base"/></div>
      <select aria-label="商品分類" className={selectClass} value={group} onChange={e => setGroup(e.target.value)}><option value="all">全部商品</option><option value="bulk">散裝克數</option><option value="vendor">廠商成品</option><option value="other">其他庫存</option></select>
      <select aria-label="依廠商篩選" className={selectClass} value={vendor} onChange={e => setVendor(e.target.value)}><option value="all">全部廠商</option>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}<option value="unknown">未指定廠商</option></select>
    </div>
    {message ? <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg border p-4 text-sm ${message.ok ? 'bg-muted/40' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>{message.text}</p> : null}
    {refreshFailed ? <Button variant="outline" className="min-h-11" onClick={() => window.location.reload()}>重新載入庫存</Button> : null}
    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{filtered.length} / {rows.length} 項商品</span><span>{editing ? '盤點中暫停自動更新，儲存時核對庫存版本' : '頁面開啟時每 30 秒更新'}</span></div>
    <div className="overflow-hidden rounded-xl border bg-card">
      <div aria-hidden="true" className={`grid items-center gap-4 bg-muted/30 px-4 py-3 text-sm text-muted-foreground md:px-5 ${editing ? 'grid-cols-[minmax(0,1fr)_7.5rem] md:grid-cols-[minmax(0,1fr)_8rem_10rem]' : 'grid-cols-[minmax(0,1fr)_auto]'}`}><span>商品</span><span className="text-right">{editing ? '目前記錄' : '目前庫存'}</span>{editing ? <span className="hidden text-right md:block">本次清點</span> : null}</div>
      <div className="divide-y">{filtered.length ? filtered.map(row => {
        const change = changes.find(c => c.row.id === row.id);
        return <div key={row.id} className={`grid items-center gap-4 px-4 py-4 md:px-5 ${editing ? 'grid-cols-[minmax(0,1fr)_7.5rem] md:grid-cols-[minmax(0,1fr)_8rem_10rem]' : 'grid-cols-[minmax(0,1fr)_auto]'}`}>
          <div className="min-w-0">{editing ? <p className="break-words text-sm font-semibold leading-relaxed md:text-base">{row.name}</p> : <Link href={`/products/${row.id}`} className="break-words text-base font-semibold leading-relaxed hover:underline">{row.name}</Link>}<p className="mt-1 break-words text-xs text-muted-foreground">{row.vendorName || '未指定廠商'} · {row.sku}</p></div>
          <p className={`text-right font-semibold tabular-nums ${editing ? 'text-sm text-muted-foreground' : 'text-xl'}`}>{row.quantity === null ? <span className="text-xs font-normal text-muted-foreground">待確認</span> : number(row.quantity)}{row.unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{row.unit}</span> : null}</p>
          {editing ? row.canCount ? <div className="col-span-2 md:col-span-1"><label className="flex items-center justify-end gap-2"><span className="mr-auto text-sm text-muted-foreground md:hidden">本次清點</span><Input aria-label={`${row.name}本次清點數量（${row.unit}）`} type="text" inputMode="numeric" pattern="[0-9]*" placeholder="不更動" value={draft[row.id] ?? ''} disabled={blocked} onChange={e => setDraft(d => ({ ...d, [row.id]: e.target.value }))} className={`min-h-11 min-w-0 max-w-36 text-right text-base tabular-nums ${change ? 'border-foreground' : ''}`}/><span className="text-xs text-muted-foreground">{row.unit}</span></label>{change && row.quantity !== null ? <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">差異 {change.quantity > row.quantity ? '+' : ''}{number(change.quantity - row.quantity)} {row.unit}</p> : null}</div> : <p className="col-span-2 text-right text-xs text-muted-foreground md:col-span-1">待管理員完成設定</p> : null}
        </div>;
      }) : <p className="p-10 text-center text-sm text-muted-foreground">找不到符合條件的商品。</p>}</div>
    </div>
    {editing ? <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur"><div><p className="text-sm font-semibold">{changes.length ? `${changes.length} 項數量將更新` : '填入現場實際剩餘數量'}</p>{error ? <p role="alert" className="mt-1 text-sm text-destructive">{error}</p> : <p className="mt-1 text-xs text-muted-foreground">直接校正總量，並非新增進貨；人員與時間自動記錄。</p>}</div><div className="flex gap-2"><Button variant="outline" disabled={blocked} onClick={cancel} className="min-h-11">取消</Button><Button disabled={blocked || !changes.length || !!error} onClick={save} className="min-h-11">{pending ? '儲存中…' : '儲存盤點'}</Button></div></div> : null}
    {!editing ? <>
      {canVerifyUnits && setupRows.length ? <details className="rounded-xl border p-4 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-medium">管理員設定（{setupRows.length} 項待處理）</summary><p className="pb-3 text-muted-foreground">先完成商品庫存設定，執行人員才可進行盤點。</p><div className="flex flex-wrap gap-2">{setupRows.map(row => <Button asChild key={row.id} variant="outline" className="min-h-11"><Link href={`/inventory/confirm-unit/${row.id}`}>完成設定：{row.name}</Link></Button>)}</div></details> : null}
      <details className="text-sm text-muted-foreground"><summary className="cursor-pointer py-2">成本與進階管理</summary><p className="py-2">快速盤點保留原成本；需要調整成本時，請至原有盤點功能。</p><div className="flex flex-wrap gap-2">{rows.filter(r => inventoryGroup(r) === 'bulk').map(row => <Link key={row.id} href={`/inventory/stocktake/${row.id}`} className="min-h-11 rounded-lg border px-3 py-2">{row.name}：數量與成本</Link>)}</div></details>
    </> : null}
    <dialog ref={dialog} aria-labelledby="inventory-count-error-title" aria-describedby="inventory-count-error-message" className="w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40">
      <h2 id="inventory-count-error-title" className="text-lg font-semibold">盤點尚未完成</h2>
      <p id="inventory-count-error-message" className="my-4 text-sm">{message?.text}</p>
      <Button ref={acknowledge} type="button" onClick={() => dialog.current?.close()}>返回檢查</Button>
    </dialog>
  </section>;
}
