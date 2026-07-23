'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2, Search, X } from 'lucide-react';

export type CustomerSearchOption = {
  id: string;
  name: string;
  customerId: string;
  phone?: string | null;
};

function customerLabel(c: CustomerSearchOption) {
  return `${c.name} (${c.customerId})`;
}

function matchCustomer(c: CustomerSearchOption, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    c.name.toLowerCase().includes(q) ||
    c.customerId.toLowerCase().includes(q) ||
    (c.phone?.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ?? false)
  );
}

export function CustomerSearchSelect({
  customers,
  value,
  onChange,
  onSearch,
  name = 'customerId',
  required = false,
  allowEmpty = false,
  emptyLabel = '— 選擇客戶 —',
  placeholder = '搜尋姓名、編號或電話…',
  className,
}: {
  customers: CustomerSearchOption[];
  value: string;
  onChange: (customerId: string) => void;
  /** 提供時改為遠端 typeahead；customers 仍用於已選項顯示與種子清單 */
  onSearch?: (query: string) => Promise<CustomerSearchOption[]>;
  name?: string;
  required?: boolean;
  /** 是否允許不選（寄賣店訂單的選填客戶） */
  allowEmpty?: boolean;
  emptyLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<CustomerSearchOption[] | null>(null);
  const [searching, setSearching] = useState(false);

  const selected = useMemo(
    () =>
      customers.find((c) => c.id === value) ??
      remote?.find((c) => c.id === value),
    [customers, remote, value],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!onSearch || !open) return;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void onSearch(query)
        .then((rows) => setRemote(rows))
        .catch(() => setRemote([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query, open, onSearch]);

  const filtered = useMemo(() => {
    if (onSearch) {
      const list = remote ?? customers;
      return list.slice(0, 80);
    }
    return customers.filter((c) => matchCustomer(c, query)).slice(0, 80);
  }, [customers, query, onSearch, remote]);

  const displayValue = open ? query : selected ? customerLabel(selected) : '';

  function pick(id: string) {
    onChange(id);
    setQuery('');
    setOpen(false);
  }

  function clear() {
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={displayValue}
          placeholder={selected && !open ? customerLabel(selected) : placeholder}
          required={required && !value}
          className="pl-9 pr-9"
          onFocus={() => {
            setOpen(true);
            if (selected) setQuery('');
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange('');
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label="清除客戶"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={clear}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-card py-1 text-sm shadow-md"
        >
          {allowEmpty && (
            <li>
              <button
                type="button"
                role="option"
                className="w-full px-3 py-2 text-left text-muted-foreground hover:bg-muted/60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick('')}
              >
                {emptyLabel}
              </button>
            </li>
          )}
          {searching ? (
            <li className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              搜尋中…
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-3 text-center text-xs text-muted-foreground">
              {onSearch && !query.trim()
                ? '輸入關鍵字搜尋客戶'
                : '找不到符合的客戶'}
            </li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.id === value}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-muted/60',
                    c.id === value && 'bg-primary/10 font-medium',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c.id)}
                >
                  <div>{c.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {c.customerId}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
