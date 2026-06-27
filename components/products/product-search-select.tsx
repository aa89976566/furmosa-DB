'use client';

import { useMemo, useState } from 'react';
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
import { Check, ChevronsUpDown, X } from 'lucide-react';

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

function productSearchValue(p: ProductSearchOption) {
  return `${p.name} ${p.sku}`.toLowerCase();
}

export function ProductSearchSelect({
  products,
  value,
  onChange,
  name = 'productId',
  required = false,
  placeholder = '選擇或搜尋商品…',
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
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => products.find((p) => p.id === value),
    [products, value],
  );

  function pick(id: string) {
    onChange(id);
    setOpen(false);
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
        <Command>
          <CommandInput placeholder="搜尋商品名稱或 SKU…" />
          <CommandList>
            <CommandEmpty>找不到符合的商品</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={productSearchValue(p)}
                  onSelect={() => pick(p.id)}
                  className="flex-col items-start gap-0.5 py-2"
                >
                  <div className="flex w-full items-center gap-2">
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        value === p.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate font-medium">{p.name}</span>
                  </div>
                  <div className="pl-6 font-mono text-[11px] text-muted-foreground">
                    {p.sku} · {formatCurrency(p.price)} / {p.unit}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
