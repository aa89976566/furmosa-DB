'use client';

import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { initialSearchState, readSearchResponse, searchReducer } from '@/lib/logistics/pickup-search-ui';

export function PickupSearchPreview({ enabled }: { enabled: boolean }) {
  const [query, setQuery] = useState('');
  const [state, dispatch] = useReducer(searchReducer, initialSearchState);
  const sequence = useRef(0);
  const active = useRef<XMLHttpRequest | null>(null);
  useEffect(() => () => { sequence.current += 1; active.current?.abort(); }, []);

  function clearRequest() {
    sequence.current += 1;
    active.current?.abort();
    active.current = null;
    return sequence.current;
  }
  function search(event: FormEvent) {
    event.preventDefault();
    const request = clearRequest();
    if (!enabled || query.trim().length < 2) {
      dispatch({ type: 'reset', request });
      return;
    }
    dispatch({ type: 'start', request });
    const xhr = new XMLHttpRequest();
    active.current = xhr;
    const fail = (message: string) => {
      if (sequence.current === request) dispatch({ type: 'error', request, message });
    };
    xhr.open('GET', `/api/logistics/pickup-stores?temperature=ambient&q=${encodeURIComponent(query.trim())}`);
    xhr.timeout = 15000;
    xhr.onload = () => {
      if (sequence.current !== request) return;
      try {
        // Check the status before parsing so expired-session HTML cannot masquerade as an empty list.
        if (xhr.status !== 200) readSearchResponse(xhr.status, null);
        const stores = readSearchResponse(xhr.status, JSON.parse(xhr.responseText));
        dispatch({ type: 'result', request, stores });
      } catch (error) {
        fail(error instanceof SyntaxError ? '門市資料無法讀取，請重新登入或稍後再試。' : error instanceof Error ? error.message : '門市資料無法讀取，請稍後再試。');
      }
    };
    xhr.onerror = () => fail('連線不太穩定，請再試一次。');
    xhr.ontimeout = () => fail('查詢時間較久，請再試一次。');
    xhr.send();
  }

  return (
    <section className="max-w-2xl space-y-6 rounded-xl border border-border bg-card p-4 sm:p-6" aria-label="7-ELEVEN 門市搜尋">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">想在哪間 7-ELEVEN 取貨？</h2>
        <p className="text-sm text-muted-foreground">輸入門市名稱或附近地址就能找，不用記店號。</p>
      </div>
      <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
        HQ 測試專用：目前僅查詢常溫測試資料。選取不會存入訂單，也不會產生運費或付款。
      </p>
      {!enabled && <p role="status" className="text-sm text-muted-foreground">門市搜尋尚未啟用，請先完成預覽環境設定。</p>}
      <form onSubmit={search} className="space-y-2">
        <label htmlFor="pickup-query" className="text-sm font-medium">門市名稱或地址</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input id="pickup-query" value={query} disabled={!enabled} maxLength={80} autoComplete="off"
            className="h-11 text-base" placeholder="例如：信義路、門市名稱" aria-describedby="pickup-help"
            onChange={event => {
              const request = clearRequest();
              setQuery(event.target.value);
              dispatch({ type: 'reset', request });
            }} />
          <Button type="submit" className="h-11" disabled={!enabled || query.trim().length < 2 || state.status === 'loading'}>
            {state.status === 'loading' ? '搜尋中…' : '搜尋門市'}
          </Button>
        </div>
        <p id="pickup-help" className="text-xs text-muted-foreground">至少輸入 2 個字。冷凍門市服務仍在確認中，暫不開放選取。</p>
      </form>
      <div role="status" aria-live="polite" aria-atomic="true" className="text-sm">
        {state.status === 'loading' && '正在查詢門市…'}
        {state.status === 'error' && state.message}
        {state.status === 'ready' && (state.stores.length ? `找到 ${state.stores.length} 間門市${state.stores.length === 20 ? '，最多顯示 20 間，可加上路名縮小範圍' : ''}。` : '沒有找到符合的門市，試試附近路名或其他關鍵字。')}
        {state.selected && ` 已選擇 ${state.selected.name}。`}
      </div>
      {state.stores.length > 0 && <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">選擇方便取貨的門市</legend>
        {state.stores.map(store => <label key={store.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${state.selected?.id === store.id ? 'border-primary bg-accent' : 'border-border'}`}>
          <input type="radio" name="pickup-store" value={store.id} checked={state.selected?.id === store.id}
            className="mt-1 h-5 w-5 shrink-0 accent-primary" onChange={() => dispatch({ type: 'select', id: store.id })} />
          <span className="min-w-0 space-y-1 break-words">
            <span className="block font-medium">{store.name}</span>
            <span className="block text-sm text-muted-foreground">{store.address}</span>
            <span className="block text-xs text-muted-foreground">店號 {store.id}</span>
          </span>
        </label>)}
      </fieldset>}
      {state.selected && <div className="space-y-2 rounded-xl bg-muted p-4">
        <h3 className="font-semibold">已選門市</h3>
        <p className="break-words">7-ELEVEN {state.selected.name}</p>
        <p className="break-words text-sm">{state.selected.address}</p>
        <p className="text-xs text-muted-foreground">目前僅供驗收，尚未儲存至訂單。</p>
      </div>}
      <noscript>請啟用 JavaScript 後使用門市搜尋。本頁不會代為建立訂單。</noscript>
    </section>
  );
}
