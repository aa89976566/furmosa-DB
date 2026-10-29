'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ClipboardCheck, Plus, Package, ArrowRight, ChevronLeft, ChevronRight, Pencil, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { productCategoryLabel } from '@/lib/labels';
import { inventoryGroup, parseCountQuantity, inventoryStockState, inventoryStateLabels, compareInventoryUrgency, inventoryPackEstimates, type InventoryRow } from '@/lib/inventory/workbench';
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
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState('urgency');
  const [location, setLocation] = useState('hq');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [category, setCategory] = useState('all');
  const [editing, setEditing] = useState(false);
  const [focusProductId, setFocusProductId] = useState<string | null>(null);
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
  const categories = [...new Set(rows.map(row => row.category))].sort((a,b) => (productCategoryLabel[a] ?? a).localeCompare(productCategoryLabel[b] ?? b, 'zh-TW'));
  const setupRows = rows.filter(row => row.canConfirmUnit);
  const needsSetup = rows.filter(row => row.status !== 'inactive' && (!row.productCategory || row.productCategory === 'STANDARD') && !row.canCount);
  const stockRows = rows.filter(row => row.status !== 'inactive');
  const stockCounts = { all: stockRows.length, in_stock: stockRows.filter(r => inventoryStockState(r) === 'in_stock').length,
    low: stockRows.filter(r => inventoryStockState(r) === 'low').length, zero: stockRows.filter(r => inventoryStockState(r) === 'zero').length,
    negative: stockRows.filter(r => inventoryStockState(r) === 'negative').length };
  const showStatus = (status: string) => { setStatusFilter(status); setLocation('hq'); setPage(1); };
  useEffect(() => { setPage(1); }, [q, group, vendor, category, pageSize, sort, location]);
  const filtered = activeRows.filter(row => (statusFilter === 'inactive' ? row.status === 'inactive' : row.status !== 'inactive') &&
    (location !== 'hq' || statusFilter === 'all' || statusFilter === 'inactive' || (statusFilter === 'low' && inventoryStockState(row) === 'low') || (statusFilter === 'in_stock' && inventoryStockState(row) === 'in_stock') || (statusFilter === 'zero' && row.canCount && row.quantity === 0) || (statusFilter === 'needs_setup' && (!row.productCategory || row.productCategory === 'STANDARD') && !row.canCount) || (statusFilter === 'negative' && row.quantity !== null && row.quantity < 0)) && (group === 'all' || inventoryGroup(row) === group) &&
    (vendor === 'all' || (vendor === 'unknown' ? !row.vendorId : row.vendorId === vendor)) && (category === 'all' || row.category === category) &&
    `${row.name} ${row.sku} ${row.hqSku} ${row.productCode} ${row.vendorName} ${(row.merchantStocks ?? []).map(stock => stock.merchantName).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()))
    .filter(row => location !== 'merchant' || (row.merchantStocks ?? []).length > 0)
    .sort(sort === 'urgency' && location === 'hq' ? compareInventoryUrgency : (a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true }) || a.id.localeCompare(b.id));
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

  function exportInventory() {
    const cell = (value: string | number | null | undefined) => {
      const text = String(value ?? '');
      return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""') + '"';
    };
    const data = [['商品', 'SKU', '主倉現存', '單位', '補貨點', '總部狀態', '庫存分布'], ...filtered.map(row => [row.name, row.hqSku, row.quantity, row.unit, row.reorderPoint, inventoryStateLabels[inventoryStockState(row)], (row.merchantStocks ?? []).map(stock => `${stock.merchantName} ${stock.tierLabel} ${stock.quantity}件`).join('；')])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + data.map(line => line.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'furmosa-inventory.csv'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function begin(productId?: string) {
    setLocation('hq'); setSnapshot(rows); eventKey.current = crypto.randomUUID(); setMessage(null); setDraft({});
    setFocusProductId(productId ?? null); setEditing(true);
  }
  useEffect(() => {
    if (!editing || !focusProductId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`inventory-count-${focusProductId}`)?.focus();
      setFocusProductId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editing, focusProductId]);

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

  return <section aria-label="庫存工作台" className="inventory-reference space-y-5">
    <div className="inventory-heading flex flex-wrap items-start justify-between gap-3"><Link href="/dashboard" onClick={navigateAway} className="inventory-back">‹ 返回</Link>
      <div><p className="mb-1 text-xs text-muted-foreground">商品與供應 / 庫存</p><h1 className="text-2xl font-semibold tracking-tight">庫存總覽</h1><p className="mt-1 text-sm text-muted-foreground">所有商品，一眼掌握。</p></div>
      <details className="inventory-mobile-more"><summary>更多</summary><div><button type="button" onClick={exportInventory}>匯出庫存</button>{canEdit ? <Link href="/inventory/new" onClick={navigateAway}>新增入庫</Link> : null}<Link href="/inventory/purchases" onClick={navigateAway}>進貨與收貨</Link></div></details><div className="inventory-actions flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={exportInventory} className="min-h-11">匯出</Button>{canEdit && !editing ? <Button onClick={() => begin()} disabled={blocked} variant="outline" className="min-h-11"><ClipboardCheck className="mr-2 h-4 w-4"/>盤點庫存</Button> : null}{canEdit ? <Button asChild className="min-h-11 bg-[#245744] text-white hover:bg-[#1b4435]"><Link href="/inventory/new" onClick={navigateAway}><Plus className="mr-2 h-4 w-4"/>新增進貨</Link></Button> : null}</div>
    </div>
    <div className="flex flex-wrap gap-1 rounded-xl border bg-card p-1" aria-label="庫存摘要">
      {([['all', '全部', stockCounts.all], ['in_stock', '充足', stockCounts.in_stock], ['low', '偏低', stockCounts.low], ['zero', '缺貨', stockCounts.zero], ['negative', '異常', stockCounts.negative], ['needs_setup', '待設定', needsSetup.length]] as const).map(([value, label, count]) =>
        <button key={value} type="button" onClick={() => showStatus(value)} aria-pressed={location === 'hq' && statusFilter === value} className={`flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm ${location === 'hq' && statusFilter === value ? 'bg-[#eaf1ea] font-semibold text-[#245744]' : 'hover:bg-muted/40'}`}>
          <span aria-hidden="true" className={value === 'in_stock' ? 'text-emerald-600' : value === 'low' || value === 'needs_setup' ? 'text-amber-600' : value === 'zero' || value === 'negative' ? 'text-red-600' : 'text-muted-foreground'} data-stock-dot={value}>●</span>{label}<strong className="text-lg tabular-nums">{count}</strong>
        </button>)}
    </div>
    <div className="grid items-start gap-5">
      <div className="min-w-0 space-y-3">
        <nav aria-label="庫存流程" className="flex gap-6 border-b text-sm"><Link onClick={navigateAway} href="/inventory" aria-current="page" className="border-b-2 border-foreground px-1 py-3 font-semibold">目前庫存</Link><Link onClick={navigateAway} href="/inventory/purchases" className="py-3 text-muted-foreground">進貨與收貨</Link><Link onClick={navigateAway} href="/inventory/transactions" className="py-3 text-muted-foreground">異動紀錄</Link></nav>
        <div className="inventory-controls sticky top-0 z-20 space-y-3 bg-background/95 py-2 backdrop-blur">
          <nav aria-label="庫存位置" className="flex gap-4 border-b text-sm">{[['hq','總部現存'],['merchant','店家寄賣'],['all','全通路分布']].map(([value,label]) => <button key={value} type="button" disabled={editing} aria-pressed={location === value} onClick={() => setLocation(value)} className={`min-h-11 border-b-2 px-2 ${location === value ? 'border-[#245744] font-semibold text-[#245744]' : 'border-transparent text-muted-foreground'}`}>{label}</button>)}</nav>
        {editing ? <div className="rounded-lg border bg-muted/30 px-4 py-3"><h2 className="font-semibold">盤點庫存</h2><p className="mt-1 text-sm text-muted-foreground">填現場剩餘總量；空白不更動，填 0 表示歸零。切換頁碼會保留草稿。</p></div> : null}
        <div className="inventory-toolbar grid gap-2 md:grid-cols-[minmax(160px,1fr)_auto]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><Input aria-label="搜尋商品或廠商" value={q} onChange={e => setQuery(e.target.value)} placeholder="搜尋商品、SKU、廠商或店家" className="min-h-11 rounded-lg pl-9 text-sm"/></div>
          <Button type="button" variant="outline" className="min-h-11 md:hidden" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)}>篩選與排序</Button>
          <div className={`${filtersOpen ? 'grid' : 'hidden'} inventory-extra-filters grid-cols-1 gap-2 md:col-span-2 md:grid md:grid-cols-4`}>
          <select aria-label="商品分類" className={selectClass + ' text-sm'} value={group} onChange={e => setGroup(e.target.value)}><option value="all">全部商品</option><option value="bulk">散裝克數</option><option value="vendor">廠商成品</option><option value="other">其他庫存</option></select>
          <select aria-label="商品類別" className={selectClass + ' text-sm'} value={category} onChange={e => setCategory(e.target.value)}><option value="all">全部類別</option>{categories.map(value => <option key={value} value={value}>{productCategoryLabel[value] ?? value}</option>)}</select>
          <select aria-label="依廠商篩選" className={selectClass + ' text-sm'} value={vendor} onChange={e => setVendor(e.target.value)}><option value="all">全部廠商</option>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}<option value="unknown">未指定廠商</option></select>
          <select aria-label="庫存排序" className={selectClass + ' text-sm'} value={sort} onChange={e => setSort(e.target.value)}><option value="urgency">急需處理優先</option><option value="name">商品名稱排序</option></select>
          <select aria-label="庫存狀態" className={selectClass + ' text-sm'} value={statusFilter} onChange={e => showStatus(e.target.value)}>{[['all','全部狀態'],['in_stock','充足'],['low','偏低'],['zero','缺貨'],['negative','異常'],['needs_setup','待設定'],['inactive','已停用']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
        </div>
        <div aria-label="庫存狀態篩選" className="flex gap-2 overflow-x-auto pb-1">{[['all','使用中'],['in_stock','充足'],['zero','無庫存'],['low','低於補貨點'],['needs_setup','待設定'],['negative','負庫存'],['inactive','已停用']].map(([value,label]) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => showStatus(value)} className={`min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm transition-colors ${statusFilter === value ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-muted'}`}>{label}</button>)}</div>
        </div>
        {message ? <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg border p-3 text-sm ${message.ok ? 'bg-muted/40' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>{message.text}</p> : null}
        {refreshFailed ? <Button variant="outline" className="min-h-11" onClick={() => window.location.reload()}>重新載入庫存</Button> : null}
        <p className="text-xs leading-relaxed text-muted-foreground">{location === 'hq' ? '主倉現存為帳面實存；尚未啟用獨立保留量，不推算可售量。偏低依商品補貨點判定。' : '店家庫存依規格以件數呈現，與總部克數分開，不跨單位加總；此處不包含在途貨。'}</p>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table aria-label="全商品庫存" className="block w-full text-left text-sm md:table md:min-w-[800px]">
            <thead className="hidden bg-muted/40 text-xs md:table-header-group text-muted-foreground"><tr><th className="px-4 py-3 font-medium">商品</th><th className="px-3 py-3 font-medium">廠商</th><th className="whitespace-nowrap px-3 py-3 text-right font-medium">{location === 'merchant' ? '店家分布' : '主倉現存'}</th><th className="px-3 py-3 text-right font-medium">{location === 'hq' ? '保留量' : '其他庫存位置'}</th><th className="px-3 py-3 font-medium">狀態</th><th className="px-4 py-3 text-right font-medium">{editing ? '本次清點' : '操作'}</th></tr></thead>
            <tbody className="block divide-y md:table-row-group">{visibleRows.map(row => {
              const change = changes.find(c => c.row.id === row.id);
              const isInactive = row.status === 'inactive';
              const state = inventoryStockState(row);
              const label = inventoryStateLabels[state];
              const tone = state === 'negative' || state === 'zero' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200' : state === 'low' || state === 'needs_setup' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : state === 'in_stock' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-muted text-muted-foreground';
              const estimates = inventoryPackEstimates(row);
              return <tr key={row.id} data-stock-state={location === 'merchant' ? 'merchant' : state} className={`grid grid-cols-[minmax(0,1fr)_minmax(100px,auto)] gap-x-3 px-3 py-2 md:table-row md:p-0 ${location === 'hq' && state === 'negative' ? 'bg-red-50/50 dark:bg-red-950/10' : location === 'hq' && state === 'low' ? 'bg-amber-50/40 dark:bg-amber-950/10' : 'hover:bg-muted/20'}`}>
                <td className="min-w-0 py-2 md:max-w-80 md:px-4 md:py-3"><div className="flex items-center gap-3">{row.imageUrl ? <img src={row.imageUrl} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 rounded-md border bg-muted/20 object-contain"/> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/40 text-muted-foreground"><Package className="h-4 w-4"/></span>}<div className="min-w-0"><Link href={`/products/${row.id}`} onClick={navigateAway} className="line-clamp-2 font-medium hover:underline">{row.name.replace(/[◈◇◆]/g,'').replace(/\s+/g,' ').trim()}</Link><p className="mt-0.5 text-xs text-muted-foreground">{row.hqSku}{row.sku !== row.hqSku ? ` · ${row.sku}` : ''}</p></div></div></td>
                <td data-column="vendor" className="hidden max-w-32 px-3 py-2.5 text-muted-foreground md:table-cell"><span className="line-clamp-2">{row.vendorName || '待補'}</span><span className="sr-only">{row.sku}</span></td>
                <td data-column="quantity" className="max-w-[140px] py-2 text-right align-top md:max-w-64 md:px-3 md:py-3">
                  {location === 'merchant' ? <StockLocations row={row} /> : <>
                    <strong className={`whitespace-nowrap text-xl tabular-nums ${state === 'negative' || state === 'zero' ? 'text-red-700 dark:text-red-300' : state === 'low' ? 'text-amber-700 dark:text-amber-300' : 'text-[#245744] dark:text-emerald-300'}`}>{row.quantity === null ? '—' : number(row.quantity)}<span className="ml-1 text-xs font-normal">{row.unit}</span></strong>
                    {estimates.length ? <div className="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">約可裝 {estimates.slice(0,2).map(tier => `${tier.weight}g × ${number(tier.packs)}包`).join(' 或 ')}{estimates.length > 2 ? <details><summary className="cursor-pointer py-2">其他 {estimates.length - 2} 種規格</summary>{estimates.slice(2).map(tier => <span key={tier.weight} className="block">{tier.weight}g 約 {number(tier.packs)}包</span>)}</details> : null}</div> : null}
                    {row.reorderPoint !== undefined && row.unit ? <p className="mt-1 text-xs text-muted-foreground">補貨點 {number(row.reorderPoint)}{row.unit}</p> : null}
                  </>}
                </td>
                <td className={`${location === 'hq' ? 'hidden' : 'col-span-2'} px-0 py-1 text-xs text-muted-foreground md:table-cell md:max-w-64 md:px-3 md:py-3 md:text-right`}>{location === 'hq' ? <span className="hidden md:inline" title="系統尚未啟用獨立保留量">—<span className="block text-xs">未啟用</span></span> : location === 'all' ? <StockLocations row={row} includeWarehouses /> : <span>{row.otherWarehouses.length ? '另有其他倉庫庫存，請切換全通路分布' : '與總部數量分開計算'}</span>}</td>
                <td className="col-start-2 row-start-2 pb-1 text-right md:max-w-44 md:px-3 md:py-3 md:text-left"><span data-stock-badge={state} className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{location === 'merchant' ? '店家持有' : label}</span><span aria-hidden="true" className="inventory-level"><i /></span>{!row.canCount && editing ? <p className="mt-1 max-w-40 text-xs leading-relaxed text-muted-foreground">{row.countBlockedReason ?? '庫存單位尚未確認'}</p> : null}</td>
                <td className="col-span-2 flex items-center justify-end border-t border-dashed pt-2 text-right md:table-cell md:w-48 md:border-0 md:px-4 md:py-3">{editing && row.canCount && !isInactive ? <div><label className="flex items-center justify-end gap-1"><Input id={`inventory-count-${row.id}`} aria-label={`${row.name}本次清點數量（${row.unit}）`} type="text" inputMode="numeric" pattern="[0-9]*" placeholder="不更動" value={draft[row.id] ?? ''} disabled={blocked} onChange={e => setDraft(d => ({ ...d, [row.id]: e.target.value }))} className={`min-h-11 w-24 text-right text-base tabular-nums ${change ? 'border-foreground' : ''}`}/><span className="text-xs text-muted-foreground">{row.unit}</span></label>{change && row.quantity !== null ? <p className="mt-1 text-xs text-muted-foreground">差異 {change.quantity > row.quantity ? '+' : ''}{number(change.quantity-row.quantity)} {row.unit}</p> : null}</div> : canVerifyUnits && row.canConfirmUnit ? <Button asChild variant="outline" className="min-h-10 text-xs"><Link href={`/inventory/confirm-unit/${row.id}`} onClick={navigateAway}>{editing ? '設定單位與首次庫存' : '完成設定'}</Link></Button> : <div className="flex flex-wrap justify-end gap-2">{canEdit && row.canCount && !isInactive && !editing ? <Button type="button" variant="outline" className="min-h-10 px-3 text-xs" onClick={() => begin(row.id)}><Pencil className="mr-1 h-3.5 w-3.5"/>修改庫存</Button> : null}<Button asChild variant="outline" className="min-h-10 px-3 text-xs"><Link href={`/inventory/transactions?product=${encodeURIComponent(row.id)}`} onClick={navigateAway}><History className="mr-1 h-3.5 w-3.5"/>庫存紀錄</Link></Button><Button asChild variant="outline" className="min-h-10 px-3 text-xs"><Link href={`/products/${row.id}`} onClick={navigateAway}>查看商品</Link></Button>{editing && !row.canCount && !canVerifyUnits ? <p className="mt-1 text-xs text-muted-foreground">請管理員完成設定後再盤點</p> : null}</div>}</td>
              </tr>;
            })}</tbody>
          </table>
          {!filtered.length ? <p className="p-10 text-center text-sm text-muted-foreground">找不到符合條件的商品。</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{filtered.length ? `顯示 ${(currentPage-1)*pageSize+1}–${Math.min(currentPage*pageSize,filtered.length)} 項 · ` : ''}{filtered.length} / {rows.length} 項商品</span><label className="flex items-center gap-2">每頁<select aria-label="每頁商品數" value={pageSize} className="min-h-11 rounded-lg border bg-background px-2 text-sm" onChange={e => setPageSize(Number(e.target.value))}><option value={10}>10 項</option><option value={25}>25 項</option><option value={50}>50 項</option><option value={Math.max(rows.length, 51)}>全部商品</option></select></label><div aria-label="庫存分頁" className="flex items-center gap-2"><Button size="sm" variant="outline" aria-label="上一頁" disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}><ChevronLeft className="h-4 w-4"/></Button><span className="tabular-nums">{currentPage} / {pageCount}</span><Button size="sm" variant="outline" aria-label="下一頁" disabled={currentPage === pageCount} onClick={() => setPage(currentPage+1)}><ChevronRight className="h-4 w-4"/></Button></div></div>
        {editing ? <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur"><div><p className="text-sm font-semibold">{changes.length ? `${changes.length} 項數量將更新（含其他頁）` : '填入現場實際剩餘數量'}</p>{error ? <p role="alert" className="mt-1 text-sm text-destructive">{error}</p> : <p className="mt-1 text-xs text-muted-foreground">校正總量；空白不變，人員與時間自動記錄。</p>}</div><div className="flex gap-2"><Button variant="outline" disabled={blocked} onClick={cancel} className="min-h-11">取消</Button><Button disabled={blocked || !changes.length || !!error} onClick={save} className="min-h-11">{pending ? '儲存中…' : '儲存盤點'}</Button></div></div> : null}
        {!editing ? <details className="text-sm text-muted-foreground"><summary className="cursor-pointer py-2">成本與進階管理</summary><p className="py-2">快速盤點保留原成本；需要調整成本時，請至原有盤點功能。</p><div className="flex flex-wrap gap-2">{rows.filter(r => inventoryGroup(r) === 'bulk').map(row => <Link key={row.id} onClick={navigateAway} href={`/inventory/stocktake/${row.id}`} className="min-h-11 rounded-lg border px-3 py-2">{row.name}：數量與成本</Link>)}</div></details> : null}
      </div>
      <aside aria-label="庫存待辦" className="rounded-lg border bg-card p-4"><h2 className="border-b pb-4 text-lg font-semibold">今天先處理</h2><div className="space-y-3 border-b py-5"><h3 className="font-semibold"><span className="mr-2 text-amber-500">●</span>{pendingCount} 筆進貨待收貨</h3><p className="text-sm text-muted-foreground">按本次實收數量入庫。</p><Link onClick={navigateAway} href="/inventory/purchases?view=pending" className="inline-flex min-h-10 items-center gap-2 text-sm text-blue-700 dark:text-blue-300">查看待收貨<ArrowRight className="h-4 w-4"/></Link></div><div className="space-y-3 py-5"><h3 className="font-semibold"><span className="mr-2 text-amber-500">●</span>{needsSetup.length} 項商品待設定</h3><p className="text-sm text-muted-foreground">先核對單位與商品狀態，再進行盤點。</p><button type="button" onClick={() => showStatus('needs_setup')} className="inline-flex min-h-10 items-center gap-2 text-sm text-blue-700 dark:text-blue-300">查看待設定<ArrowRight className="h-4 w-4"/></button></div>
        {purchaseAlerts.length ? <div className="space-y-3 rounded-lg bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"><h3 className="font-semibold">進貨單據需核對</h3>{purchaseAlerts.map(alert => <Link onClick={navigateAway} key={alert.id} href={`/inventory/purchase-orders/${alert.id}`} className="block text-sm underline-offset-4 hover:underline"><span className="font-medium">{alert.title}</span><span className="mt-1 block text-xs opacity-80">{alert.detail}</span></Link>)}</div> : null}
        {canVerifyUnits && setupRows.length && !editing ? <details className="mt-4 border-t pt-3 text-sm"><summary className="min-h-11 cursor-pointer py-3">管理員設定（{setupRows.length} 項待處理）</summary><div className="space-y-2">{setupRows.map(row => <Link key={row.id} href={`/inventory/confirm-unit/${row.id}`} className="block min-h-10 text-xs underline">完成設定：{row.name}</Link>)}</div></details> : null}
        <div className="mt-5 space-y-1 border-t pt-4 text-xs leading-relaxed text-muted-foreground"><p>進貨增加主倉 · 出貨扣主倉</p><p>POS 銷售扣店庫存</p><p className="pt-2">{editing ? '盤點中暫停自動更新，儲存時核對庫存版本' : '頁面開啟時每 30 秒更新'}</p></div>
      </aside>
    </div>
    <nav aria-label="手機庫存導覽" className="inventory-mobile-nav"><Link href="/inventory" onClick={navigateAway} aria-current="page"><Package size={20}/>總覽</Link>{canEdit ? <button type="button" disabled={blocked || editing} onClick={() => begin()}><ClipboardCheck size={20}/>盤點</button> : null}<Link href="/inventory/transactions" onClick={navigateAway}><ClipboardCheck size={20}/>紀錄</Link></nav>
    <dialog ref={dialog} aria-labelledby="inventory-count-error-title" aria-describedby="inventory-count-error-message" className="w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40"><h2 id="inventory-count-error-title" className="text-lg font-semibold">盤點尚未完成</h2><p id="inventory-count-error-message" className="my-4 text-sm">{message?.text}</p><Button ref={acknowledge} type="button" onClick={() => dialog.current?.close()}>返回檢查</Button></dialog>
  </section>;
}

function StockLocations({ row, includeWarehouses = false }: { row: InventoryRow; includeWarehouses?: boolean }) {
  const stocks = row.merchantStocks ?? [];
  return <details className="text-left text-xs">
    <summary className="min-h-11 cursor-pointer py-2">{stocks.length ? `${new Set(stocks.map(stock => stock.merchantId)).size} 家店庫存紀錄` : '無店家庫存紀錄'}{includeWarehouses && row.otherWarehouses.length ? ` · ${row.otherWarehouses.length} 個其他倉庫` : ''}</summary>
    <div className="space-y-2 pb-2">{stocks.map((stock, index) => <p key={`${stock.merchantId}-${index}`}><span>{stock.merchantName} · {stock.tierLabel}</span><strong className={stock.quantity < 0 ? 'ml-2 text-red-700' : 'ml-2'}>{number(stock.quantity)} 件{stock.quantity < 0 ? ' · 待核對' : stock.quantity === 0 ? ' · 缺貨' : ''}</strong></p>)}
    {includeWarehouses ? row.otherWarehouses.map((warehouse, index) => <p key={index}>{warehouse.name} · {warehouse.unit ? `${number(warehouse.quantity)} ${warehouse.unit}` : '單位待核對'}</p>) : null}</div>
  </details>;
}
