'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  isGlobalSearchListPath,
  resolveGlobalSearchHref,
} from '@/lib/global-search-nav';

/**
 * 全站搜尋：統一導向分類結果頁。跨頁時用完整導頁，避免手機 RSC 導航失敗
 * 讓目前畫面直接落入錯誤邊界；結果頁內換字則保留快速的 client navigation。
 */
export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onList = isGlobalSearchListPath(pathname);
  const qFromUrl = onList ? (searchParams.get('q') ?? '') : '';
  const [value, setValue] = useState(qFromUrl);

  useEffect(() => {
    setValue(qFromUrl);
  }, [qFromUrl, pathname]);

  const navigateWithQuery = (raw: string) => {
    const next = resolveGlobalSearchHref(pathname, searchParams.toString(), raw);
    if (!next) return;
    // iOS 上跨頁 RSC 曾偶發中斷；完整導頁可保留瀏覽器原生重試能力。
    if (onList) router.replace(next, { scroll: false });
    else window.location.assign(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateWithQuery(value);
  };

  return (
    <form onSubmit={handleSubmit} className="relative max-w-md flex-1" role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜尋訂單、電話、店家、商品…"
        className="h-9 rounded-md border-border/80 bg-muted/30 pl-9 pr-10 text-sm shadow-none focus-visible:bg-card"
        aria-label="搜尋"
        enterKeyHint="search"
        autoComplete="off"
        inputMode="search"
        maxLength={80}
      />
      <button
        type="submit"
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="執行搜尋"
        title="搜尋"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}
