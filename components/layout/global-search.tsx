'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const SEARCHABLE_PREFIXES = [
  '/products',
  '/orders',
  '/customers',
  '/merchants',
  '/vendors',
  '/shipments',
  '/subscriptions',
];

export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const jarExchange = pathname.startsWith('/jar-exchange');
  const qFromUrl = jarExchange ? '' : (searchParams.get('q') ?? '');
  const [value, setValue] = useState(qFromUrl);

  useEffect(() => {
    if (!jarExchange) setValue(qFromUrl);
    else setValue('');
  }, [qFromUrl, jarExchange]);

  const searchable = SEARCHABLE_PREFIXES.some((prefix) => {
    // 廠商詳情頁不掛 q，避免以為有篩選；搜尋改導向產品列表
    if (prefix === '/vendors') return pathname === '/vendors';
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });

  useEffect(() => {
    if (!searchable) return;

    const timer = window.setTimeout(() => {
      const trimmed = value.trim();
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      const query = params.toString();
      const next = query ? `${pathname}?${query}` : pathname;
      const current = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
      if (next !== current) {
        router.replace(next, { scroll: false });
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [value, searchable, pathname, router, searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!searchable) {
      if (trimmed) router.push(`/orders?q=${encodeURIComponent(trimmed)}`);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <form onSubmit={handleSubmit} className="relative max-w-md flex-1" role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜尋訂單、電話、收件人、店家、商品…"
        className="h-8 rounded-md border-border/80 bg-muted/30 pl-9 text-sm shadow-none focus-visible:bg-card"
        aria-label="搜尋"
      />
    </form>
  );
}
