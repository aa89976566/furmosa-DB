'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { Search, X } from 'lucide-react';

export type ProductSearchOption = {
  id: string;
  name: string;
  sku: string;
  price: number;
  unit: string;
};

function productLabel(p: ProductSearchOption) {
  return `${p.name} · ${p.sku}`;
}

function matchProduct(p: ProductSearchOption, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    p.name.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q)
  );
}

export function ProductSearchSelect({
  products,
  value,
  onChange,
  name = 'productId',
  required = false,
  placeholder = '搜尋商品名稱或 SKU…',
  className,
  inputClassName,
}: {
  products: ProductSearchOption[];
  value: string;
  onChange: (productId: string) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => products.find((p) => p.id === value),
    [products, value],
  );

  const filtered = useMemo(() => {
    return products.filter((p) => matchProduct(p, query)).slice(0, 80);
  }, [products, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const displayValue = open ? query : selected ? productLabel(selected) : '';

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
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={displayValue}
          placeholder={placeholder}
          required={required && !value}
          className={cn('h-9 pl-8 pr-8 text-sm', inputClassName)}
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
            aria-label="清除商品"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={clear}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[100] mt-1 max-h-52 w-full min-w-[240px] overflow-auto rounded-md border bg-card py-1 text-sm shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-center text-xs text-muted-foreground">
              找不到符合的商品
            </li>
          ) : (
            filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.id === value}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-muted/60',
                    p.id === value && 'bg-primary/10 font-medium',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p.id)}
                >
                  <div className="truncate">{p.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {p.sku} · {formatCurrency(p.price)} / {p.unit}
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
