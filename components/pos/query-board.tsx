"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, PackageCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  filterQueryFeed,
  type QueryFeedItem,
  type QueryKind,
} from "@/lib/pos/query-feed";

const TABS: { id: QueryKind | "all"; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "sale", label: "銷售" },
  { id: "refill", label: "換罐" },
  { id: "restock", label: "補貨" },
  { id: "stock", label: "庫存" },
];

export function QueryBoard({ items, initialQuery = "" }: { items: QueryFeedItem[]; initialQuery?: string }) {
  const [kind, setKind] = useState<QueryKind | "all">("all");
  const [query, setQuery] = useState(initialQuery);
  const visible = useMemo(
    () => filterQueryFeed(items, kind, query),
    [items, kind, query],
  );
  const awaitingReceipt = visible.filter(
    (item) => item.kind === "restock" && item.status === "是否已收到？",
  );
  const history = visible.filter(
    (item) => !(item.kind === "restock" && item.status === "是否已收到？"),
  );

  return (
    <div className="space-y-6">
      {awaitingReceipt.length > 0 ? (
        <section aria-labelledby="pending-record-actions" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-sm font-medium text-primary">現在需要處理</p><h2 id="pending-record-actions" className="text-lg font-semibold text-foreground">待確認收貨 {awaitingReceipt.length}</h2></div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">匠寵已寄出</span>
          </div>
          {awaitingReceipt.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-[0_14px_38px_rgba(22,50,37,0.08)]">
              <div className="flex gap-4 p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><PackageCheck className="h-6 w-6" aria-hidden /></span>
                <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{item.whenLabel} 寄出</p><h3 className="mt-1 font-semibold text-foreground">這批補貨收到了嗎？</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.subtitle}</p></div>
              </div>
              <div className="grid gap-2 border-t border-border bg-primary/[0.025] p-4 sm:grid-cols-[1fr_auto]">
                <Link href={item.href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_rgba(26,91,62,0.2)] transition hover:bg-primary/90">已收到，開始核對<ArrowRight className="h-4 w-4" aria-hidden /></Link>
                <Link href="https://line.me/R/ti/p/@furmosa_food" target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-primary/20 bg-card px-5 text-sm font-semibold text-primary">尚未收到・聯絡匠寵</Link>
              </div>
              <p className="px-5 pb-4 text-xs text-muted-foreground">尚未收到不用入庫；系統會依寄出時間再次提醒。</p>
            </article>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="record-history-title" className="space-y-4">
        <div><h2 id="record-history-title" className="text-lg font-semibold text-foreground">歷史紀錄</h2><p className="mt-1 text-sm text-muted-foreground">查詢銷售、換罐、補貨及庫存異動。</p></div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜尋紀錄"
          placeholder="搜尋訂單、商品、罐子序號"
          className="h-12 rounded-2xl border-border bg-card pl-10 shadow-sm focus-visible:ring-primary/35"
        />
      </div>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="查詢分類"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={kind === tab.id}
            className={`min-h-[40px] shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
              kind === tab.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary"
            }`}
            onClick={() => setKind(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {history.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          沒有符合的資料。
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_12px_32px_rgba(22,50,37,0.05)]">
          {history.map((item) => (
            <li
              key={item.id}
              className="border-b border-border last:border-b-0"
            >
              <Link
                href={item.href}
                className="block transition-colors hover:bg-primary/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
              >
                <div className="flex min-h-[74px] items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {item.whenLabel}
                    </p>
                    <p className="truncate font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {item.subtitle}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
                    {item.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </section>
    </div>
  );
}
