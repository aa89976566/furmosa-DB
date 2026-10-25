'use client';
import Link from 'next/link';
import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ClipboardCheck, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inventoryGroup, parseCountQuantity, type InventoryRow } from '@/lib/inventory/workbench';
import { saveInventoryQuantities } from './quantity-actions';
const groups = [['all', '全部庫存'], ['bulk', '散裝克數'], ['vendor', '廠商成品'], ['other', '其他庫存']] as const;
const number = (value: number) => value.toLocaleString('zh-TW');
const selectClass = 'min-h-11 rounded-lg border bg-background px-3 text-base text-foreground';
export function InventoryWorkbench({ rows, canEdit, canVerifyUnits = false, initialQuery = '' }: {
    rows: InventoryRow[];
    canEdit: boolean;
    canVerifyUnits?: boolean;
    initialQuery?: string;
}) {
    const router = useRouter();
    const [q, setQuery] = useState(initialQuery), [group, setGroup] = useState('all'), [vendor, setVendor] = useState('all');
    const [editing, setEditing] = useState(false), [reviewing, setReviewing] = useState(false);
    const [snapshot, setSnapshot] = useState<InventoryRow[]>(rows);
    const activeRows = editing ? snapshot : rows;
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [reason, setReason] = useState('例行實體盤點');
    const [message, setMessage] = useState<{
        ok: boolean;
        text: string;
    } | null>(null);
    const [pending, startTransition] = useTransition(), [refreshing, refreshTransition] = useTransition();
    const eventKey = useRef('');
    const blocked = pending || refreshing;
    const suppliers = useMemo(() => [...new Map(rows.filter(r => r.vendorId).map(r => [r.vendorId!, r.vendorName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-TW')), [rows]);
    const filtered = activeRows.filter(row => (group === 'all' || inventoryGroup(row) === group) && (vendor === 'all' || (vendor === 'unknown' ? !row.vendorId : row.vendorId === vendor)) && `${row.name} ${row.sku} ${row.productCode} ${row.vendorName}`.toLowerCase().includes(q.trim().toLowerCase()));
    const changes: {
        row: InventoryRow;
        quantity: number;
    }[] = [];
    let error = '';
    for (const row of activeRows) {
        const raw = draft[row.id];
        if (raw === undefined || raw.trim() === '')
            continue;
        try {
            const quantity = parseCountQuantity(raw);
            if (quantity !== row.quantity && row.canCount)
                changes.push({ row, quantity });
        }
        catch {
            error = `${row.name}：請輸入 0 以上的整數`;
        }
    }
    if (changes.length > 100)
        error = '每次最多更新 100 項商品，請分批盤點';
    function begin() { setSnapshot(rows); eventKey.current = crypto.randomUUID(); setMessage(null); setDraft({}); setEditing(true); setReviewing(false); }
    function cancel() { setDraft({}); setEditing(false); setReviewing(false); setMessage(null); }
    function save() {
        if (blocked || !changes.length || error)
            return;
        const form = new FormData();
        form.set('eventKey', eventKey.current);
        form.set('reason', reason);
        form.set('lines', JSON.stringify(changes.map(({ row, quantity }) => ({ productId: row.id, quantity: String(quantity), expectedVersion: row.version }))));
        startTransition(async () => {
            try {
                const result = await saveInventoryQuantities(form);
                setMessage({ ok: result.ok, text: result.message });
                if (result.ok) {
                    setDraft({});
                    setEditing(false);
                    setReviewing(false);
                    refreshTransition(() => router.refresh());
                }
            }
            catch {
                setMessage({ ok: false, text: '連線中斷，請重新整理確認是否已儲存，再決定是否重試' });
            }
        });
    }
    return <section aria-label="庫存工作台" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="庫存分類" className="flex flex-wrap gap-1">{groups.map(([key, label]) => <button key={key} type="button" aria-pressed={group === key} onClick={() => setGroup(key)} className={`min-h-11 rounded-lg px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${group === key ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{label}</button>)}</nav>{canEdit && !editing ? <Button onClick={begin} disabled={blocked} variant="outline" className="min-h-11"><ClipboardCheck className="mr-2 h-4 w-4"/>盤點數量</Button> : null}</div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><Input aria-label="搜尋商品或廠商" value={q} onChange={e => setQuery(e.target.value)} placeholder="搜尋商品、SKU 或廠商" className="min-h-11 pl-10 text-base"/></div><label className="flex items-center gap-3 text-sm text-muted-foreground">廠商<select aria-label="依廠商篩選" className={`${selectClass} min-w-0 flex-1 sm:max-w-56`} value={vendor} onChange={e => setVendor(e.target.value)}><option value="all">全部廠商</option>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}<option value="unknown">未指定廠商</option></select></label></div>
    {message ? <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg border p-4 text-sm ${message.ok ? 'bg-muted/40' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>{message.text}</p> : null}
    <div className="flex justify-between gap-3 text-sm text-muted-foreground"><span>{filtered.length} / {rows.length} 項商品</span><span>{editing ? '盤點中 · 空白代表不更動' : 'HQ 主倉現有庫存'}</span></div>
    <div className="overflow-hidden rounded-xl border bg-card"><div className={`hidden gap-6 bg-muted/30 px-5 py-3 text-sm text-muted-foreground md:grid ${editing ? 'md:grid-cols-[minmax(0,1fr)_8rem_10rem]' : 'md:grid-cols-[minmax(0,1fr)_8rem_8rem]'}`} aria-hidden="true"><span>商品／廠商</span><span className="text-right">現有數量</span><span className="text-right">{editing ? '實際剩餘數量' : '操作'}</span></div><div className="divide-y">{filtered.length ? filtered.map(row => {
            const change = changes.find(c => c.row.id === row.id);
            return <div key={row.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 px-4 py-5 md:gap-6 md:px-5 ${editing ? 'md:grid-cols-[minmax(0,1fr)_8rem_10rem]' : 'md:grid-cols-[minmax(0,1fr)_8rem_8rem]'}`}>
        <div className="min-w-0"><Link href={`/products/${row.id}`} className="break-words text-base font-semibold leading-relaxed hover:underline">{row.name}</Link><p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">{row.vendorName || '未指定廠商'}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{row.sku}{row.hqSku !== row.sku ? <span className="ml-2">HQ {row.hqSku}</span> : null}</p>{row.otherWarehouses.length ? <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer py-1">其他倉庫</summary>{row.otherWarehouses.map(w => <p key={w.name}>{w.name}：{number(w.quantity)} {w.unit || '單位待確認'}</p>)}</details> : null}</div>
        <p className="text-right text-2xl font-semibold tabular-nums tracking-tight">{row.quantity === null ? <span className="text-sm font-medium text-warning">待確認</span> : number(row.quantity)}{row.unit ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">{row.unit}</span> : null}</p>
        <div className="col-span-2 flex items-center justify-between gap-3 md:col-span-1 md:block md:text-right">{editing && row.canCount ? <><label className="flex items-center justify-end gap-2"><span className="text-sm md:sr-only">實際剩餘</span><Input aria-label={`${row.name}實際剩餘數量（${row.unit}）`} type="text" inputMode="numeric" pattern="[0-9]*" placeholder="未更動" value={draft[row.id] ?? ''} disabled={blocked} onChange={e => { setReviewing(false); setDraft(d => ({ ...d, [row.id]: e.target.value })); }} className={`min-h-11 w-28 text-right text-base tabular-nums ${change ? 'border-foreground' : ''}`}/><span className="text-sm text-muted-foreground">{row.unit}</span></label>{change ? <p className="mt-1 text-xs tabular-nums">{row.quantity === null ? '首次確認' : `差異 ${change.quantity > row.quantity ? '+' : ''}${number(change.quantity - row.quantity)} ${row.unit}`}</p> : null}</> : row.canCount && canEdit ? <Button type="button" variant="outline" className="min-h-11" disabled={blocked} onClick={begin}>更新數量</Button> : canVerifyUnits && !row.canCount ? <Link href={`/inventory/confirm-unit/${row.id}`} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">核對庫存單位</Link> : <span className="text-xs text-muted-foreground">{canEdit && !row.canCount ? '請先核對商品與庫存單位' : '僅供查看'}</span>}{!editing ? <Link className="ml-3 inline-flex min-h-11 items-center text-xs text-muted-foreground underline underline-offset-4 md:ml-0 md:mt-1" href={`/inventory/transactions?product=${encodeURIComponent(row.id)}`}>異動紀錄</Link> : null}</div>
      </div>;
        }) : <p className="p-12 text-center text-sm text-muted-foreground">找不到符合條件的商品。</p>}</div></div>
    {editing && !reviewing ? <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur"><div><p className="text-sm font-semibold">{changes.length ? `${changes.length} 項待更新` : '填入現場實際剩餘數量'}</p>{error ? <p role="alert" className="mt-1 text-sm text-destructive">{error}</p> : <p className="mt-1 text-xs text-muted-foreground">時間與人員自動記錄，不需填寫成本。</p>}</div><div className="flex gap-2"><Button variant="outline" disabled={blocked} onClick={cancel} className="min-h-11">取消</Button><Button disabled={blocked || !changes.length || !!error} onClick={() => setReviewing(true)} className="min-h-11">核對變更</Button></div></div> : null}
    {reviewing ? <section aria-label="核對庫存變更" className="space-y-4 rounded-xl border bg-card p-5"><div><h2 className="text-lg font-semibold">確認這次盤點</h2><p className="mt-1 text-sm text-muted-foreground">以下 {changes.length} 項將更新為實際數量。</p></div><ul className="divide-y">{changes.map(({ row, quantity }) => <li key={row.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{row.name}</span><span className="tabular-nums">{row.quantity === null ? '待確認' : number(row.quantity)} → <strong>{number(quantity)} {row.unit}</strong></span></li>)}</ul><label className="block text-sm">調整原因<select value={reason} onChange={e => setReason(e.target.value)} disabled={blocked} className={`${selectClass} mt-2 w-full`}><option>例行實體盤點</option><option>重新清點修正</option><option>耗損／報廢盤點</option></select></label><div className="flex justify-end gap-2"><Button variant="outline" disabled={blocked} onClick={() => setReviewing(false)} className="min-h-11">返回修改</Button><Button disabled={blocked || !!error || !changes.length} onClick={save} className="min-h-11">{pending ? '儲存中…' : '確認更新'}</Button></div></section> : null}
    <details className="text-sm text-muted-foreground"><summary className="cursor-pointer py-2">成本與進階管理</summary><p className="py-2">快速盤點保留原成本；需要調整成本時，請至原有盤點功能。</p><div className="flex flex-wrap gap-2">{rows.filter(r => inventoryGroup(r) === 'bulk').map(row => <Link key={row.id} href={`/inventory/stocktake/${row.id}`} className="min-h-11 rounded-lg border px-3 py-2">{row.name}：數量與成本</Link>)}</div></details>
    <Link href="/inventory/transactions" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><History className="h-4 w-4"/>全部庫存異動紀錄</Link>
  </section>;
}
