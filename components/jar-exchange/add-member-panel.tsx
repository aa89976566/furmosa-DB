'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PetProfileFieldsBlock } from '@/components/customers/pet-profile-fields-block';
import {
  addJarExchangeMember,
  createJarExchangeMemberFromForm,
  searchCustomersForJarMember,
} from '@/app/(main)/jar-exchange/actions';
import { CUSTOMER_ID_EXAMPLE } from '@/lib/customers/customer-id-format';

type Mode = 'existing' | 'new';

type CustomerOption = {
  id: string;
  name: string;
  customerId: string;
  phone: string | null;
  isJarMember: boolean;
};

function customerLabel(c: CustomerOption) {
  return `${c.name} (${c.customerId})`;
}

export function JarExchangeAddMemberPanel() {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<Mode>('existing');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [selected, setSelected] = useState<CustomerOption | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const rows = await searchCustomersForJarMember(term);
      setResults(rows.map((c) => ({ ...c, isJarMember: c.isJarMember ?? false })));
    } catch (e) {
      setError(e instanceof Error ? e.message : '搜尋失敗');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void runSearch(query);
    }, 280);
    return () => clearTimeout(t);
  }, [query, open, runSearch]);

  const refreshList = () => {
    void router.refresh();
  };

  const handleAddExisting = async () => {
    if (!selected) {
      setError('請選擇客戶');
      return;
    }
    if (selected.isJarMember) {
      setError('此客戶已是換罐會員');
      return;
    }

    setPending(true);
    setMsg(null);
    setError(null);
    try {
      const res = await addJarExchangeMember(selected.id);
      if (res.ok) {
        setMsg(
          res.alreadyMember
            ? `${res.name} 已是換罐會員`
            : `已將 ${res.name} 加入換罐會員`,
        );
        setSelected(null);
        setQuery('');
        setResults([]);
        refreshList();
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加入失敗，請確認連線後再試');
    } finally {
      setPending(false);
    }
  };

  const handleCreateNew = async (form: HTMLFormElement) => {
    setPending(true);
    setMsg(null);
    setError(null);
    try {
      const res = await createJarExchangeMemberFromForm(new FormData(form));
      if (res.ok) {
        setMsg(`已建立 ${res.name}（${res.customerId}）並加入換罐會員`);
        form.reset();
        refreshList();
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '建立失敗，請確認連線後再試');
    } finally {
      setPending(false);
    }
  };

  const displayValue = open ? query : selected ? customerLabel(selected) : '';

  return (
    <details className="mb-4 rounded-2xl border border-border/60 bg-card shadow-card open:shadow-md">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-primary">＋</span> 新增換罐會員
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          可選現有客戶或建立新客戶
        </span>
      </summary>

      <div className="space-y-4 border-t border-border/60 px-4 pb-4 pt-3">
        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
          {(
            [
              ['existing', '加入現有客戶'],
              ['new', '建立新客戶'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                setMsg(null);
                setError(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'existing' ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div ref={rootRef} className="relative min-w-0 flex-1 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                輸入姓名、CUST 編號或電話搜尋客戶主檔
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  role="combobox"
                  aria-expanded={open}
                  aria-controls={listId}
                  value={displayValue}
                  placeholder={`例如：王小明 或 ${CUSTOMER_ID_EXAMPLE}`}
                  className="pl-9 pr-9"
                  onFocus={() => {
                    setOpen(true);
                    if (selected) setQuery('');
                  }}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                    if (selected) setSelected(null);
                  }}
                />
                {selected ? (
                  <button
                    type="button"
                    aria-label="清除"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      setSelected(null);
                      setQuery('');
                      setResults([]);
                    }}
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
                  {searching ? (
                    <li className="px-3 py-3 text-center text-xs text-muted-foreground">
                      搜尋中…
                    </li>
                  ) : query.trim().length < 1 ? (
                    <li className="px-3 py-3 text-center text-xs text-muted-foreground">
                      請輸入關鍵字
                    </li>
                  ) : results.length === 0 ? (
                    <li className="px-3 py-3 text-center text-xs text-muted-foreground">
                      找不到符合的客戶
                    </li>
                  ) : (
                    results.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          role="option"
                          disabled={c.isJarMember}
                          className={cn(
                            'w-full px-3 py-2 text-left hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50',
                            selected?.id === c.id && 'bg-primary/10 font-medium',
                          )}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelected(c);
                            setQuery('');
                            setOpen(false);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{c.name}</span>
                            {c.isJarMember ? (
                              <span className="text-[10px] text-muted-foreground">已是換罐會員</span>
                            ) : null}
                          </div>
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
            <Button
              type="button"
              disabled={pending || !selected || selected.isJarMember}
              onClick={() => void handleAddExisting()}
            >
              {pending ? '處理中…' : '加入換罐會員'}
            </Button>
          </div>
        ) : (
          <form
            className="grid max-w-2xl gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateNew(e.currentTarget);
            }}
          >
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                姓名 <span className="text-destructive">*</span>
              </label>
              <Input name="name" required maxLength={60} placeholder="王小明" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">類型</label>
              <select
                name="type"
                defaultValue="individual"
                className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
              >
                <option value="individual">個人</option>
                <option value="business">企業</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">電話</label>
              <Input name="phone" type="tel" maxLength={40} placeholder="0912-345-678" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input name="email" type="email" maxLength={120} placeholder="選填" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">LINE 顯示名稱</label>
              <Input name="lineDisplay" maxLength={60} placeholder="選填" />
            </div>
            <div className="sm:col-span-2">
              <PetProfileFieldsBlock />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? '建立中…' : '建立並加入換罐會員'}
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/customers/new">完整客戶表單</Link>
              </Button>
            </div>
          </form>
        )}

        {msg ? <p className="text-sm text-success">{msg}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </details>
  );
}
