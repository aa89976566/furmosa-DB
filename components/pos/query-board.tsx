"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { filterQueryFeed, type QueryFeedItem, type QueryKind } from "@/lib/pos/query-feed";

const TABS: { id: QueryKind | "all"; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "sale", label: "銷售" },
  { id: "refill", label: "換罐" },
  { id: "stock", label: "庫存" },
];

const KIND_LABELS: Record<QueryKind, string> = {
  sale: "銷售",
  refill: "換罐",
  restock: "補貨",
  stock: "庫存",
};

export function QueryBoard({ items, initialQuery = "" }: { items: QueryFeedItem[]; initialQuery?: string }) {
  const [kind, setKind] = useState<QueryKind | "all">("all");
  const [query, setQuery] = useState(initialQuery);
  const visible = useMemo(() => filterQueryFeed(items, kind, query), [items, kind, query]);
  const awaitingReceipt = items.filter(
    (item) => item.kind === "restock" && item.status === "是否已收到？",
  );
  const groupedHistory = useMemo(() => {
    const groups = new Map<string, QueryFeedItem[]>();
    for (const item of visible) {
      const key = item.dateLabel ?? item.whenLabel;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    return [...groups.entries()];
  }, [visible]);
  const firstAwaiting = awaitingReceipt[0];

  return (
    <div className="space-y-7">
      {firstAwaiting ? (
        <section aria-label="待收貨" className="overflow-hidden rounded-3xl border-2 border-primary/15 bg-primary/[0.045] shadow-sm">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Truck className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">待收貨</h2>
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-sm font-semibold text-primary-foreground">{awaitingReceipt.length}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">匠寵補貨・{firstAwaiting.dateLabel?.split("（")[0] ?? firstAwaiting.whenLabel} 寄出</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{firstAwaiting.subtitle}</p>
            </div>
            <Link href={firstAwaiting.href} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-primary px-8 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">確認收貨</Link>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="record-history-title" className="space-y-4">
        <h1 id="record-history-title" className="text-2xl font-semibold text-foreground">紀錄</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜尋紀錄" placeholder="搜尋訂單、商品、罐子序號" className="h-14 rounded-2xl border-2 border-border bg-card pl-12 shadow-none focus-visible:ring-primary/35" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="查詢分類">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={kind === tab.id} className={`min-h-11 shrink-0 rounded-2xl border px-5 text-sm font-semibold transition-colors ${kind === tab.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary"}`} onClick={() => setKind(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-3xl border-2 border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">沒有符合的資料。</div>
        ) : (
          <div className="overflow-hidden rounded-3xl border-2 border-border bg-card shadow-sm">
            {groupedHistory.map(([date, group]) => (
              <section key={date} aria-label={date}>
                <h2 className="bg-muted/70 px-4 py-2.5 text-sm font-medium text-foreground">{date}</h2>
                <ul className="divide-y divide-border">
                  {group.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} className="grid min-h-[70px] grid-cols-[52px_64px_minmax(0,1fr)_20px] items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 sm:grid-cols-[64px_84px_minmax(0,1fr)_20px]">
                        <time className="text-sm tabular-nums text-muted-foreground">{item.timeLabel ?? item.whenLabel}</time>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-center text-xs font-semibold text-primary">{KIND_LABELS[item.kind]}</span>
                        <span className="min-w-0"><span className="block truncate font-medium text-foreground">{item.title}</span><span className="block truncate text-sm text-muted-foreground">{item.subtitle}</span></span>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
