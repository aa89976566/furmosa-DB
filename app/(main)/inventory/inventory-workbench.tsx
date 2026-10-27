'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ClipboardCheck, Plus, Package, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inventoryGroup, parseCountQuantity, type InventoryRow } from '@/lib/inventory/workbench';
import { saveInventoryQuantities } from './quantity-actions';

const number = (value: number) => value.toLocaleString('zh-TW');
const selectClass = 'min-h-11 min-w-0 rounded-lg border bg-background px-3 text-base text-foreground';
export function InventoryWorkbench({ rows, canEdit, canVerifyUnits = false, initialQuery = '', pendingCount = 0, purchaseAlerts = [] }: {
  pendingCount?: number; purchaseAlerts?: { id: string; title: string; detail: string }[]; rows: InventoryRow[]; canEdit: boolean; canVerifyUnits?: boolean; initialQuery?: string;
}) {
  const router = useRouter();
  const [q, setQuery] = useState(initialQuery), [group, setGroup] = useState('all'), [vendor, setVendor] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
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
  const needsSetup = rows.filter(row => row.status !== 'inactive' && (!row.productCategory || row.productCategory === 'STANDARD') && !row.canCount);
  const showStatus = (status: string) => { setStatusFilter(status); setPage(1); };
  useEffect(() => { setPage(1); }, [q, group, vendor]);
  const filtered = activeRows.filter(row => (statusFilter === 'inactive' ? row.status === 'inactive' : row.status !== 'inactive') &&
    (statusFilter === 'all' || statusFilter === 'inactive' || (statusFilter === 'in_stock' && row.canCount && (row.quantity ?? 0) > 0) || (statusFilter === 'zero' && row.canCount && row.quantity === 0) || (statusFilter === 'needs_setup' && (!row.productCategory || row.productCategory === 'STANDARD') && !row.canCount) || (statusFilter === 'negative' && row.quantity !== null && row.quantity < 0)) && (group === 'all' || inventoryGroup(row) === group) &&
    (vendor === 'all' || (vendor === 'unknown' ? !row.vendorId : row.vendorId === vendor)) &&
    `${row.name} ${row.sku} ${row.hqSku} ${row.productCode} ${row.vendorName}`.toLowerCase().includes(q.trim().toLowerCase()));
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const navigateAway = (event: React.MouseEvent) => { if (hasDraft && !window.confirm('離開會放棄尚未儲存的盤點，確定繼續？')) event.preventDefault(); };
  const changes: { row: InventoryRow; quantity: number }[] = [];
  let error = '';
  for (const row of activeRows) {
    const raw = draft[row.id];
    if (raw === undefined || raw.trim() === '') continue;
    try {
      const quantity = parseCountQuantity(raw);
      if (quantity !== row.quantity && row.canCount && row.status !== 'inactive') changes.push({ row, quantity });
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

  return <section aria-label="庫存工作台" className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="mb-1 text-xs text-muted-foreground">商品與供應 / 庫存</p><h1 className="text-3xl font-semibold tracking-tight">庫存</h1><p className="mt-1 text-sm text-muted-foreground">主倉現有量與進貨狀態，一頁掌握</p></div>
      <div className="flex gap-2">{canEdit && !editing ? <Button onClick={begin} disabled={blocked} variant="outline" className="min-h-11"><ClipboardCheck className="mr-2 h-4 w-4"/>盤點庫存</Button> : null}{canEdit ? <Button asChild className="min-h-11"><Link href="/inventory/new" onClick={navigateAway}><Plus className="mr-2 h-4 w-4"/>新增進貨</Link></Button> : null}</div>
    </div>
    <div className="grid grid-cols-3 divide-x rounded-lg border bg-card" aria-label="庫存摘要">
      <button type="button" onClick={() => showStatus('all')} className="min-h-20 px-2 py-3 text-center hover:bg-muted/40"><span className="block text-xs text-muted-foreground sm:text-sm">全部品項</span><strong className="text-2xl tabular-nums">{rows.length}</strong></button>
      <Link onClick={navigateAway} href="/inventory/purchases?view=pending" className="min-h-20 px-2 py-3 text-center hover:bg-muted/40"><span className="block text-xs text-muted-foreground sm:text-sm"><span className="mr-1 text-amber-500">●</span>待收貨</span><strong className="text-2xl tabular-nums">{pendingCount}<span className="ml-1 text-sm font-normal">筆</span></strong></Link>
      <button type="button" onClick={() => showStatus('needs_setup')} className="min-h-20 px-2 py-3 text-center hover:bg-muted/40"><span className="block text-xs text-muted-foreground sm:text-sm"><span className="mr-1 text-amber-500">●</span>待設定</span><strong className="text-2xl tabular-nums">{needsSetup.length}<span className="ml-1 text-sm font-normal">項</span></strong></button>
    </div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-3">
        <nav aria-label="庫存流程" className="flex gap-6 border-b text-sm"><Link onClick={navigateAway} href="/inventory" aria-current="page" className="border-b-2 border-foreground px-1 py-3 font-semibold">目前庫存</Link><Link onClick={navigateAway} href="/inventory/purchases" className="py-3 text-muted-foreground">進貨與收貨</Link><Link onClick={navigateAway} href="/inventory/transactions" className="py-3 text-muted-foreground">異動紀錄</Link></nav>
        {editing ? <div className="rounded-lg border bg-muted/30 px-4 py-3"><h2 className="font-semibold">盤點庫存</h2><p className="mt-1 text-sm text-muted-foreground">填現場剩餘總量；空白不更動，填 0 表示歸零。切換頁碼會保留草稿。</p></div> : null}
        <div className="grid gap-2 sm:grid-cols-[minmax(160px,1fr)_135px_145px]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><Input aria-label="搜尋商品或廠商" value={q} onChange={e => setQuery(e.target.value)} placeholder="搜尋商品、SKU、廠商" className="min-h-11 rounded-lg pl-9 text-sm"/></div>
          <select aria-label="商品分類" className={selectClass + ' text-sm'} value={group} onChange={e => setGroup(e.target.value)}><option value="all">全部商品</option><option value="bulk">散裝克數</option><option value="vendor">廠商成品</option><option value="other">其他庫存</option></select>
          <select aria-label="依廠商篩選" className={selectClass + ' text-sm'} value={vendor} onChange={e => setVendor(e.target.value)}><option value="all">全部廠商</option>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}<option value="unknown">未指定廠商</option></select>
        </div>
        <div aria-label="庫存狀態篩選" className="flex flex-wrap gap-2">{[['all','使用中'],['in_stock','有庫存'],['zero','無庫存'],['needs_setup','待設定'],['negative','負庫存'],['inactive','已停用']].map(([value,label]) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => showStatus(value)} className={`min-h-10 rounded-full border px-4 text-sm transition-colors ${statusFilter === value ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-muted'}`}>{label}</button>)}</div>
        {message ? <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg border p-3 text-sm ${message.ok ? 'bg-muted/40' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>{message.text}</p> : null}
        {refreshFailed ? <Button variant="outline" className="min-h-11" onClick={() => window.location.reload()}>重新載入庫存</Button> : null}
        <p className="text-xs text-muted-foreground md:hidden">左右滑動表格可查看數量與操作。</p>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">商品</th><th className="px-3 py-3 font-medium">廠商</th><th className="whitespace-nowrap px-3 py-3 text-right font-medium">主倉數量</th><th className="px-3 py-3 font-medium">狀態</th><th className="px-4 py-3 text-right font-medium">{editing ? '本次清點' : '操作'}</th></tr></thead>
            <tbody className="divide-y">{visibleRows.map(row => {
              const change = changes.find(c => c.row.id === row.id);
              const isInactive = row.status === 'inactive';
              const label = isInactive ? '已停用' : row.productCategory && row.productCategory !== 'STANDARD' ? '非一般庫存' : row.quantity !== null && row.quantity < 0 ? '負庫存待核對' : !row.canCount ? row.canConfirmUnit ? row.quantity === null ? '待建立庫存' : '單位待核對' : '需核對設定' : row.quantity === 0 ? '無庫存' : '正常';
              const tone = isInactive ? 'bg-muted text-muted-foreground' : !row.canCount || (row.quantity ?? 0) < 0 ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : row.quantity === 0 ? 'bg-muted text-muted-foreground' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
              return <tr key={row.id} className="hover:bg-muted/20">
                <td className="max-w-72 px-4 py-2.5"><div className="flex items-center gap-3">{row.imageUrl ? <img src={row.imageUrl} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 rounded-md border bg-muted/20 object-contain"/> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/40 text-muted-foreground"><Package className="h-4 w-4"/></span>}<div className="min-w-0"><Link href={`/products/${row.id}`} onClick={navigateAway} className="line-clamp-2 font-medium hover:underline">{row.name.replace(/[◈◇◆]/g,'').replace(/\s+/g,' ').trim()}</Link><p className="mt-0.5 text-xs text-muted-foreground">{row.hqSku}</p></div></div></td>
                <td className="max-w-32 px-3 py-2.5 text-muted-foreground"><span className="line-clamp-2">{row.vendorName || '待補'}</span><span className="sr-only">{row.sku}</span></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-base font-medium tabular-nums">{row.quantity === null ? <span className="text-muted-foreground">—</span> : number(row.quantity)}{row.unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{row.unit}</span> : null}</td>
                <td className="max-w-44 px-3 py-2.5"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>{!row.canCount && editing ? <p className="mt-1 max-w-40 text-xs leading-relaxed text-muted-foreground">{row.countBlockedReason ?? '庫存單位尚未確認'}</p> : null}</td>
                <td className="w-40 px-4 py-2.5 text-right">{editing && row.canCount && !isInactive ? <div><label className="flex items-center justify-end gap-1"><Input aria-label={`${row.name}本次清點數量（${row.unit}）`} type="text" inputMode="numeric" pattern="[0-9]*" placeholder="不更動" value={draft[row.id] ?? ''} disabled={blocked} onChange={e => setDraft(d => ({ ...d, [row.id]: e.target.value }))} className={`min-h-11 w-24 text-right text-base tabular-nums ${change ? 'border-foreground' : ''}`}/><span className="text-xs text-muted-foreground">{row.unit}</span></label>{change && row.quantity !== null ? <p className="mt-1 text-xs text-muted-foreground">差異 {change.quantity > row.quantity ? '+' : ''}{number(change.quantity-row.quantity)} {row.unit}</p> : null}</div> : canVerifyUnits && row.canConfirmUnit ? <Button asChild variant="outline" className="min-h-10 text-xs"><Link href={`/inventory/confirm-unit/${row.id}`} onClick={navigateAway}>{editing ? '設定單位與首次庫存' : '完成設定'}</Link></Button> : <><Button asChild variant="outline" className="min-h-10 px-4 text-xs"><Link href={`/products/${row.id}`} onClick={navigateAway}>查看</Link></Button>{editing && !row.canCount && !canVerifyUnits ? <p className="mt-1 text-xs text-muted-foreground">請管理員完成設定後再盤點</p> : null}</>}</td>
              </tr>;
            })}</tbody>
          </table>
          {!filtered.length ? <p className="p-10 text-center text-sm text-muted-foreground">找不到符合條件的商品。</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{filtered.length ? `顯示 ${(currentPage-1)*pageSize+1}–${Math.min(currentPage*pageSize,filtered.length)} 項 · ` : ''}{filtered.length} / {rows.length} 項商品</span><div aria-label="庫存分頁" className="flex items-center gap-2"><Button size="sm" variant="outline" aria-label="上一頁" disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}><ChevronLeft className="h-4 w-4"/></Button><span className="tabular-nums">{currentPage} / {pageCount}</span><Button size="sm" variant="outline" aria-label="下一頁" disabled={currentPage === pageCount} onClick={() => setPage(currentPage+1)}><ChevronRight className="h-4 w-4"/></Button></div></div>
        {editing ? <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur"><div><p className="text-sm font-semibold">{changes.length ? `${changes.length} 項數量將更新（含其他頁）` : '填入現場實際剩餘數量'}</p>{error ? <p role="alert" className="mt-1 text-sm text-destructive">{error}</p> : <p className="mt-1 text-xs text-muted-foreground">校正總量；空白不變，人員與時間自動記錄。</p>}</div><div className="flex gap-2"><Button variant="outline" disabled={blocked} onClick={cancel} className="min-h-11">取消</Button><Button disabled={blocked || !changes.length || !!error} onClick={save} className="min-h-11">{pending ? '儲存中…' : '儲存盤點'}</Button></div></div> : null}
        {!editing ? <details className="text-sm text-muted-foreground"><summary className="cursor-pointer py-2">成本與進階管理</summary><p className="py-2">快速盤點保留原成本；需要調整成本時，請至原有盤點功能。</p><div className="flex flex-wrap gap-2">{rows.filter(r => inventoryGroup(r) === 'bulk').map(row => <Link key={row.id} onClick={navigateAway} href={`/inventory/stocktake/${row.id}`} className="min-h-11 rounded-lg border px-3 py-2">{row.name}：數量與成本</Link>)}</div></details> : null}
      </div>
      <aside aria-label="庫存待辦" className="rounded-lg border bg-card p-5 xl:sticky xl:top-20"><h2 className="border-b pb-4 text-lg font-semibold">今天先處理</h2><div className="space-y-3 border-b py-5"><h3 className="font-semibold"><span className="mr-2 text-amber-500">●</span>{pendingCount} 筆進貨待收貨</h3><p className="text-sm text-muted-foreground">按本次實收數量入庫。</p><Link onClick={navigateAway} href="/inventory/purchases?view=pending" className="inline-flex min-h-10 items-center gap-2 text-sm text-blue-700 dark:text-blue-300">查看待收貨<ArrowRight className="h-4 w-4"/></Link></div><div className="space-y-3 py-5"><h3 className="font-semibold"><span className="mr-2 text-amber-500">●</span>{needsSetup.length} 項商品待設定</h3><p className="text-sm text-muted-foreground">先核對單位與商品狀態，再進行盤點。</p><button type="button" onClick={() => showStatus('needs_setup')} className="inline-flex min-h-10 items-center gap-2 text-sm text-blue-700 dark:text-blue-300">查看待設定<ArrowRight className="h-4 w-4"/></button></div>
        {purchaseAlerts.length ? <div className="space-y-3 rounded-lg bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"><h3 className="font-semibold">進貨單據需核對</h3>{purchaseAlerts.map(alert => <Link onClick={navigateAway} key={alert.id} href={`/inventory/purchase-orders/${alert.id}`} className="block text-sm underline-offset-4 hover:underline"><span className="font-medium">{alert.title}</span><span className="mt-1 block text-xs opacity-80">{alert.detail}</span></Link>)}</div> : null}
        {canVerifyUnits && setupRows.length && !editing ? <details className="mt-4 border-t pt-3 text-sm"><summary className="min-h-11 cursor-pointer py-3">管理員設定（{setupRows.length} 項待處理）</summary><div className="space-y-2">{setupRows.map(row => <Link key={row.id} href={`/inventory/confirm-unit/${row.id}`} className="block min-h-10 text-xs underline">完成設定：{row.name}</Link>)}</div></details> : null}
        <div className="mt-5 space-y-1 border-t pt-4 text-xs leading-relaxed text-muted-foreground"><p>進貨增加主倉 · 出貨扣主倉</p><p>POS 銷售扣店庫存</p><p className="pt-2">{editing ? '盤點中暫停自動更新，儲存時核對庫存版本' : '頁面開啟時每 30 秒更新'}</p></div>
      </aside>
    </div>
    <dialog ref={dialog} aria-labelledby="inventory-count-error-title" aria-describedby="inventory-count-error-message" className="w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40"><h2 id="inventory-count-error-title" className="text-lg font-semibold">盤點尚未完成</h2><p id="inventory-count-error-message" className="my-4 text-sm">{message?.text}</p><Button ref={acknowledge} type="button" onClick={() => dialog.current?.close()}>返回檢查</Button></dialog>
  </section>;
}
