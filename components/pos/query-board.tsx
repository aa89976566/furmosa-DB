"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Circle, Download, Search, SlidersHorizontal, Truck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { filterQueryFeed, type QueryFeedItem, type QueryKind } from "@/lib/pos/query-feed";

type QueryTab = QueryKind | "all" | "today";

const TABS: { id: QueryTab; label: string }[] = [
  { id: "all", label: "全部" }, { id: "today", label: "今日" }, { id: "sale", label: "銷售" },
  { id: "restock", label: "收貨" }, { id: "stock", label: "盤點" },
  { id: "refill", label: "換罐計畫" },
];
const LABELS: Record<QueryKind, string> = { sale: "銷售", refill: "換罐計畫", restock: "補貨", stock: "盤點" };
const COLORS: Record<QueryKind, string> = { sale: "bg-rose-400", refill: "bg-violet-400", restock: "bg-emerald-500", stock: "bg-sky-400" };

function step(item: QueryFeedItem) {
  if (item.restockProgress?.stage === "received") return 3;
  if (item.restockProgress?.stage === "in_transit") return 2;
  return 1;
}

function StepDot({ active, complete }: { active: boolean; complete: boolean }) {
  return <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${complete ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary bg-card text-primary" : "border-border bg-card text-muted-foreground"}`}>
    {complete ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3 fill-current" />}
  </span>;
}

function ProgressPanel({ item, onClose }: { item: QueryFeedItem; onClose?: () => void }) {
  const [notReceived, setNotReceived] = useState(false);
  const detail = item.restockProgress;
  if (!detail) return null;
  const current = step(item);
  const received = detail.stage === "received";
  const inTransit = detail.stage === "in_transit";
  const title = detail.stage === "cancelled" ? "已取消" : received ? "店家已收貨" : inTransit ? "運送中" : "尚未出貨";
  return <aside className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:sticky lg:top-6" aria-label="補貨進度">
    <div className="flex items-start justify-between gap-4">
      <h2 className="text-xl font-bold tracking-tight">補貨進度</h2>
      {onClose ? <button type="button" onClick={onClose} aria-label="關閉補貨進度" className="-mr-2 -mt-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-5 w-5" /></button> : null}
    </div>
    <p className="mt-1 text-sm text-muted-foreground">匠寵補貨・{detail.summaryLabel}</p>
    <div className="mt-5 flex items-center justify-center gap-3 rounded-xl bg-primary/[0.07] px-4 py-5 text-primary">
      <Truck className="h-7 w-7" /><strong className="text-2xl">{title}</strong>
    </div>
    {detail.stage !== "cancelled" ? <div className="relative mt-6">
      <div className="absolute left-[16.66%] right-[16.66%] top-4 h-0.5 bg-border" />
      <div className="absolute left-[16.66%] top-4 h-0.5 bg-primary" style={{ width: current === 1 ? "0" : current === 2 ? "33.33%" : "66.66%" }} />
      <ol className="relative grid grid-cols-3 text-center">
        {["尚未出貨", "運送中", "店家已收貨"].map((label, index) => <li key={label} className="flex min-w-0 flex-col items-center">
          <StepDot active={current === index + 1} complete={current > index + 1 || (received && index === 2)} />
          <span className={`mt-2 text-xs font-semibold ${current >= index + 1 ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
        </li>)}
      </ol>
    </div> : null}
    <dl className="mt-6 divide-y divide-border border-y border-border text-sm">
      {detail.shippedDateLabel ? <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">寄出日期</dt><dd className="font-medium">{detail.shippedDateLabel}</dd></div> : null}
      <div className="py-3">
        <dt className="text-muted-foreground">本次品項</dt>
        <dd className="mt-2 space-y-2">{detail.items.map((product, index) => <div key={`${product.label}-${product.quantityLabel}-${index}`} className="flex items-start justify-between gap-4"><span className="font-medium">{product.label}</span><strong className="shrink-0 text-primary">× {product.quantityLabel}</strong></div>)}</dd>
      </div>
      {detail.receivedDateLabel ? <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">收貨日期</dt><dd className="font-medium">{detail.receivedDateLabel}</dd></div> : detail.reminderDateLabel ? <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">收貨提醒</dt><dd className="font-medium">{detail.reminderDateLabel}</dd></div> : null}
    </dl>
    {notReceived ? <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">已保留「運送中」，不會變更庫存；系統仍會按原定時間再次提醒。</p> : null}
    <div className="mt-5 grid gap-2.5">
      <Link href={item.href} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">{received ? "查看收貨明細" : inTransit ? "確認收到貨" : "查看補貨單"}</Link>
      {inTransit ? <button type="button" onClick={() => setNotReceived(true)} className="min-h-12 rounded-xl border border-primary bg-card px-5 text-sm font-bold text-primary hover:bg-primary/[0.04]">還沒收到</button> : null}
      <a href="https://line.me/R/ti/p/@furmosa_food" target="_blank" rel="noreferrer" className="mt-1 text-center text-sm font-semibold text-primary underline underline-offset-4">聯繫匠寵客服</a>
    </div>
  </aside>;
}

export function QueryBoard({ items, initialQuery = "", todayDateLabel = "" }: { items: QueryFeedItem[]; initialQuery?: string; todayDateLabel?: string }) {
  const [kind, setKind] = useState<QueryTab>("all");
  const [query, setQuery] = useState(initialQuery);
  const [selectedId, setSelectedId] = useState(() => items.find((item) => item.restockProgress)?.id ?? "");
  const [detailOpen, setDetailOpen] = useState(false);
  const visible = useMemo(() => {
    const filtered = filterQueryFeed(items, kind === "today" ? "all" : kind, query);
    if (kind !== "today") return filtered;
    return filtered.filter((item) => item.dateLabel === todayDateLabel);
  }, [items, kind, query, todayDateLabel]);
  const selected = items.find((item) => item.id === selectedId && item.restockProgress) ?? items.find((item) => item.restockProgress);
  const groups = useMemo(() => {
    const map = new Map<string, QueryFeedItem[]>();
    for (const item of visible) map.set(item.dateLabel ?? item.whenLabel, [...(map.get(item.dateLabel ?? item.whenLabel) ?? []), item]);
    return [...map.entries()];
  }, [visible]);
  function exportRows() {
    const rows = [["日期", "時間", "類型", "品項", "規格或說明", "數量或狀態"], ...visible.map((i) => [i.dateLabel ?? "", i.timeLabel ?? "", i.eventLabel ?? LABELS[i.kind], i.title, i.subtitle, i.quantityLabel ?? i.status])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "店內紀錄.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="space-y-5">
    <header className="flex items-start justify-between gap-4"><div><h1 className="text-4xl font-black tracking-tight sm:text-5xl">紀錄</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">查看店內每一次商品異動</p></div><button type="button" onClick={exportRows} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-semibold hover:text-primary"><Download className="h-5 w-5" /><span className="hidden sm:inline">匯出</span></button></header>
    <section aria-label="搜尋與分類" className="border-b border-border">
      <div className="flex gap-3"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜尋紀錄" placeholder="搜尋品項、日期或數量" className="h-16 rounded-lg border border-border bg-card pl-14 text-base shadow-none" /></div><button type="button" aria-label="篩選紀錄" className="inline-flex h-16 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-5 font-semibold"><SlidersHorizontal className="h-5 w-5" /><span className="hidden sm:inline">篩選</span><ChevronDown className="hidden h-4 w-4 sm:block" /></button></div>
      <div className="mt-3 flex gap-7 overflow-x-auto" role="tablist">{TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={kind === tab.id} onClick={() => setKind(tab.id)} className={`relative min-h-12 shrink-0 px-1 text-sm font-semibold ${kind === tab.id ? "text-primary" : "text-muted-foreground"}`}>{tab.label}{kind === tab.id ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" /> : null}</button>)}</div>
    </section>
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
      <section aria-label="紀錄清單">{visible.length === 0 ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">沒有符合的資料。</div> : <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">{groups.map(([date, group]) => <section key={date}><div className="flex items-center justify-between bg-muted/60 px-6 py-3"><h2 className="text-xl font-bold">{date}</h2><span className="text-sm text-muted-foreground">{group.length} 筆異動 <ChevronDown className="ml-2 inline h-4 w-4" /></span></div><ul className="divide-y divide-border">{group.map((item) => {
        const active = selected?.id === item.id;
        const row = <><span className={`absolute inset-y-1 left-0 w-1 rounded-r-full ${COLORS[item.kind]}`} /><time className="text-sm tabular-nums text-muted-foreground sm:text-base">{item.timeLabel ?? item.whenLabel}</time><span className="flex items-center gap-2 text-sm text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-full ${COLORS[item.kind]}`} />{item.eventLabel ?? LABELS[item.kind]}</span><span className="min-w-0"><strong className="block text-sm sm:text-base">{item.title}</strong><span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground sm:text-sm">{item.subtitle}</span></span><strong className="whitespace-nowrap text-right text-sm text-primary sm:text-lg">{item.quantityLabel ?? item.status}</strong><ChevronRight className="h-5 w-5 text-muted-foreground" /></>;
        const cls = `relative grid min-h-[86px] w-full min-w-0 grid-cols-[50px_68px_minmax(0,1fr)_auto_20px] items-center gap-2 px-4 py-3 text-left transition sm:grid-cols-[64px_78px_minmax(0,1fr)_auto_20px] sm:gap-3 sm:px-5 ${active ? "bg-primary/[0.07]" : "hover:bg-primary/[0.035]"}`;
        return <li key={item.id}>{item.restockProgress ? <button type="button" className={cls} onClick={() => { setSelectedId(item.id); setDetailOpen(true); }} aria-pressed={active}>{row}</button> : <Link href={item.href} className={cls}>{row}</Link>}</li>;
      })}</ul></section>)}</div>}</section>
      {selected ? <div className="hidden lg:block"><ProgressPanel key={selected.id} item={selected} /></div> : null}
    </div>
    {detailOpen && selected ? <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="補貨物流詳情">
      <button type="button" aria-label="關閉補貨物流詳情" className="absolute inset-0 bg-foreground/35" onClick={() => setDetailOpen(false)} />
      <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-card p-3 shadow-2xl sm:left-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[390px] sm:max-h-none sm:rounded-2xl">
        <ProgressPanel key={selected.id} item={selected} onClose={() => setDetailOpen(false)} />
      </div>
    </div> : null}
  </div>;
}
