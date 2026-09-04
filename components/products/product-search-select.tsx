'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';

export type ProductSearchOption = {
  id: string;
  name: string;
  sku: string;
  price: number;
  unit: string;
  availableStock?: number;
  canSelect?: boolean;
  eligibilityMessage?: string | null;
};

function productLabel(p: ProductSearchOption) {
  return `${p.name} · ${p.sku}`;
}

function productSearchValue(p: ProductSearchOption) {
  return `${p.name} ${p.sku}`.toLowerCase();
}

export function ProductSearchSelect({
  products,
  value,
  onChange,
  onSearch,
  name = 'productId',
  required = false,
  placeholder = '選擇或搜尋商品…',
  className,
  inputClassName,
}: {
  products: ProductSearchOption[];
  value: string;
  onChange: (productId: string) => void;
  /** 提供時改為遠端 typeahead；products 仍用於已選項與種子 */
  onSearch?: (query: string) => Promise<ProductSearchOption[]>;
  name?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<ProductSearchOption[] | null>(null);
  const [searching, setSearching] = useState(false);

  const selected = useMemo(
    () =>
      products.find((p) => p.id === value) ??
      remote?.find((p) => p.id === value),
    [products, remote, value],
  );

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

  const list = onSearch ? (remote ?? products) : products;
  const selectableCount = list.filter((product) => product.canSelect !== false).length;

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery('');
  }

  function clear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={value} />
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-required={required}
          className={cn(
            'h-9 w-full justify-between gap-2 px-3 font-normal shadow-sm',
            !selected && 'text-muted-foreground',
            inputClassName,
            className,
          )}
        >
          <span className="truncate text-left text-sm">
            {selected ? productLabel(selected) : placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {value ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="清除商品"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={clear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    clear(e as unknown as React.MouseEvent);
                  }
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command shouldFilter={!onSearch}>
          <CommandInput
            placeholder="搜尋商品名稱或 SKU…"
            value={onSearch ? query : undefined}
            onValueChange={onSearch ? setQuery : undefined}
          />
          <CommandList>
            {searching ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                搜尋中…
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {onSearch && !query.trim()
                    ? '輸入關鍵字搜尋商品'
                    : '找不到符合的商品'}
                </CommandEmpty>
                {list.length > 0 && selectableCount === 0 ? (
                  <div className="border-b px-3 py-2 text-xs text-muted-foreground">
                    找到商品，但目前沒有可加入本訂單的品項
                  </div>
                ) : null}
                <CommandGroup>
                  {list.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={productSearchValue(p)}
                      onSelect={() => {
                        if (p.canSelect !== false) pick(p.id);
                      }}
                      aria-disabled={p.canSelect === false}
                      className={cn(
                        'flex-col items-start gap-0.5 py-2',
                        p.canSelect === false && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <div className="flex w-full items-center gap-2">
                        <Check
                          className={cn(
                            'h-4 w-4 shrink-0',
                            value === p.id ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <span className="truncate font-medium">{p.name}</span>
                        {p.eligibilityMessage ? (
                          <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {p.eligibilityMessage}
                          </span>
                        ) : null}
                      </div>
                      <div className="pl-6 font-mono text-[11px] text-muted-foreground">
                        {p.sku} · {formatCurrency(p.price)} / {p.unit}
                        {typeof p.availableStock === 'number'
                          ? ` · 總部庫存 ${p.availableStock}`
                          : ''}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
