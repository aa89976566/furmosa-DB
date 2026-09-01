"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  filterQueryFeed,
  formatQueryWhen,
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

export function QueryBoard({ items }: { items: QueryFeedItem[] }) {
  const [kind, setKind] = useState<QueryKind | "all">("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => filterQueryFeed(items, kind, query),
    [items, kind, query],
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋訂單、商品、罐子序號"
          className="h-12 rounded-xl bg-card pl-10"
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
            className={`min-h-[40px] shrink-0 rounded-xl border-2 border-foreground px-4 text-sm font-medium ${
              kind === tab.id
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground"
            }`}
            onClick={() => setKind(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="rounded-3xl border-2 border-foreground bg-card p-5 text-sm text-muted-foreground shadow-card">
          沒有符合的資料。
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl border-2 border-foreground bg-card shadow-card">
          {visible.map((item) => (
            <li
              key={item.id}
              className="border-b border-foreground/20 last:border-b-0"
            >
              <Link
                href={item.href}
                className="block transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground"
              >
                <div className="flex min-h-[88px] items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {formatQueryWhen(item.at)}
                    </p>
                    <p className="truncate font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {item.subtitle}
                    </p>
                  </div>
                  <span className="shrink-0 border-l-2 border-foreground pl-3 text-sm font-medium text-foreground">
                    {item.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
