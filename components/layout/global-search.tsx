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
 * 全站搜尋：輸入時只更新本地 state，按 Enter 或點右側按鈕才導航。
 * 子頁（如新增訂單）會導回對應列表並帶 ?q=，避免掛在無篩選頁上看起來「沒反應」。
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
    // 離開目前子頁時用 push，方便返回；列表就地篩選用 replace
    if (onList) router.replace(next, { scroll: false });
    else router.push(next);
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
