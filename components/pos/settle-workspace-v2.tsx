'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { InventoryBottomNav, InventorySideNav } from '@/components/pos/inventory-nav';
import { RestockCartProvider } from '@/components/pos/restock-cart-provider';
import { PosPageHeader } from '@/components/pos/pos-page-header';
import type { PosAccount } from '@/lib/pos/account';
import type { StoreLedgerPageData } from '@/lib/pos/load-store-ledger';
import { formatNtd, type LedgerEntryView } from '@/lib/pos/store-ledger';

type Tab = 'overview' | 'ledger' | 'refill';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: '對帳總覽' },
  { id: 'ledger', label: '交易流水' },
  { id: 'refill', label: '換罐明細' },
];

function taipeiDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function taipeiDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function statusClass(tone: LedgerEntryView['statusTone']) {
  if (tone === 'pending') return 'bg-orange-50 text-orange-700';
  if (tone === 'alert') return 'bg-red-50 text-red-700';
  if (tone === 'settled') return 'bg-neutral-100 text-zinc-700';
  return 'bg-neutral-100 text-zinc-500';
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{hint}</p>
    </div>
  );
}

function DetailPanel({ entry }: { entry: LedgerEntryView | null }) {
  if (!entry) {
    return <p className="pt-8 text-sm text-zinc-500">選一筆流水查看款項去向</p>;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-400">流水明細</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">{entry.content}</h2>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(entry.statusTone)}`}>
          {entry.statusLabel}
        </span>
      </div>

      <dl className="mt-6 space-y-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-400">類型</dt>
          <dd className="text-right text-zinc-900">{entry.typeLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-400">時間</dt>
          <dd className="text-right text-zinc-900">{taipeiDateTime(entry.occurredAt)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-400">金額</dt>
          <dd className="text-right font-semibold text-zinc-900">{entry.amountLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-400">誰收款</dt>
          <dd className="text-right text-zinc-900">{entry.paymentMethodLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-400">款項去向</dt>
          <dd className="text-right font-medium text-zinc-900">{entry.fundDirectionLabel}</dd>
        </div>
        {entry.relatedOrderDisplay ? (
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">關聯單號</dt>
            <dd className="text-right text-zinc-900">{entry.relatedOrderDisplay}</dd>
          </div>
        ) : null}
        {entry.jarSerial ? (
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">罐底序號</dt>
            <dd className="text-right text-zinc-900">{entry.jarSerial}</dd>
          </div>
        ) : null}
      </dl>

      {entry.remark ? (
        <p className="mt-5 rounded-xl bg-neutral-100 px-3 py-3 text-sm text-zinc-600">{entry.remark}</p>
      ) : null}
    </div>
  );
}

function SettleWorkspaceInner({
  account,
  ledger,
}: {
  account: PosAccount;
  ledger: StoreLedgerPageData;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(ledger.entries[0]?.id ?? null);

  const selected = ledger.entries.find((item) => item.id === selectedId) ?? null;
  const periodLabel = `${taipeiDate(ledger.periodStart)} — ${taipeiDate(ledger.periodEnd)}`;

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ledger.entries.filter((entry) => {
      if (!q) return true;
      return [
        entry.content,
        entry.typeLabel,
        entry.customerName,
        entry.relatedOrderDisplay,
        entry.jarSerial,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [ledger.entries, query]);

  const pendingEntries = ledger.entries.filter((entry) => entry.included);

  return (
    <div className="min-h-screen bg-neutral-100 text-zinc-900 md:flex md:h-screen md:overflow-hidden">
      <InventorySideNav account={account} />

      <main className="min-w-0 flex-1 md:flex md:h-full md:flex-col md:overflow-hidden">
        <header className="border-b border-neutral-200/80 pb-0">
          <PosPageHeader
            title="結帳"
            description="查看這期要跟匠寵對的帳。"
            account={account}
          />

          <div className="mt-2 flex gap-5 overflow-x-auto px-4 md:px-6">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`-mb-px min-h-[42px] shrink-0 border-b-2 pb-2 text-sm font-medium ${
                  tab === item.id
                    ? 'border-zinc-900 text-zinc-900'
                    : 'border-transparent text-zinc-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 md:flex md:overflow-hidden">
          <div className="min-w-0 flex-1 overflow-y-auto px-4 py-5 pb-28 md:px-6 md:pb-8">
            {tab === 'overview' ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-400">本期</p>
                    <p className="mt-1 text-sm font-medium text-zinc-700">{periodLabel}</p>
                  </div>
                  <p className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs text-zinc-500">
                    {ledger.storeLabel}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <SummaryCard
                    label="店家應付匠寵"
                    value={formatNtd(ledger.summary.storeOwesFurmosa)}
                    hint="進貨款＋店家代收款"
                  />
                  <SummaryCard
                    label="匠寵應付店家"
                    value={formatNtd(ledger.summary.furmosaOwesStore)}
                    hint="優惠券補貼＋其他應付"
                  />
                  <SummaryCard
                    label="本期結算"
                    value={formatNtd(Math.abs(ledger.summary.netAmount))}
                    hint={ledger.summary.resultLabel}
                  />
                </div>

                <section className="rounded-2xl border border-neutral-200 bg-white">
                  <div className="border-b border-neutral-100 px-4 py-4 md:px-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="font-semibold text-zinc-900">待結帳</h2>
                        <p className="mt-1 text-xs text-zinc-400">只列真正需要匠寵與店家互相結算的款項</p>
                      </div>
                      <span className="text-sm text-zinc-500">{pendingEntries.length} 筆</span>
                    </div>
                  </div>
                  {pendingEntries.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-zinc-500">本期目前沒有待結帳款項。</p>
                  ) : (
                    <ul>
                      {pendingEntries.slice(0, 8).map((entry, index) => (
                        <li key={entry.id} className={index === 0 ? '' : 'border-t border-neutral-100'}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(entry.id)}
                            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-neutral-50 md:px-5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-900">{entry.content}</p>
                              <p className="mt-1 truncate text-xs text-zinc-400">
                                {entry.typeLabel} · {entry.fundDirectionLabel}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-zinc-900">{entry.amountLabel}</p>
                              <p className="mt-1 text-xs text-zinc-400">{taipeiDateTime(entry.occurredAt)}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <h2 className="font-semibold text-zinc-900">款項怎麼看</h2>
                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div>
                      <p className="font-medium text-zinc-900">匠寵已收</p>
                      <p className="mt-1 text-zinc-500">客人已在線上付款，不需要店家再匯一次。</p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900">店家代收</p>
                      <p className="mt-1 text-zinc-500">店家收了現金或款項，之後要回匠寵。</p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900">匠寵應付店家</p>
                      <p className="mt-1 text-zinc-500">例如優惠券補貼，會在結算時反向扣抵。</p>
                    </div>
                  </div>
                </section>

                <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/50 p-4">
                  <p className="text-sm font-medium text-zinc-700">正式結帳尚未開放</p>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">
                    目前可以先核對流水與應收應付。確認結帳還沒開放，這個畫面不會送出結帳。
                  </p>
                </div>
              </div>
            ) : null}

            {tab === 'ledger' ? (
              <div className="space-y-4">
                <div className="relative max-w-xl">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜尋客人、單號、罐底序號"
                    className="h-11 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-sm outline-none focus:border-zinc-400"
                  />
                </div>
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  <div className="hidden grid-cols-[110px_120px_minmax(180px,1fr)_110px_140px_100px] gap-3 border-b border-neutral-100 px-4 py-3 text-xs font-medium text-zinc-400 lg:grid">
                    <span>時間</span>
                    <span>類型</span>
                    <span>內容</span>
                    <span className="text-right">金額</span>
                    <span>誰收款</span>
                    <span>狀態</span>
                  </div>
                  {filteredEntries.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-zinc-500">沒有符合的流水。</p>
                  ) : (
                    filteredEntries.map((entry, index) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedId(entry.id)}
                        className={`grid w-full gap-2 px-4 py-3 text-left hover:bg-neutral-50 lg:grid-cols-[110px_120px_minmax(180px,1fr)_110px_140px_100px] lg:items-center lg:gap-3 ${
                          index === 0 ? '' : 'border-t border-neutral-100'
                        } ${selectedId === entry.id ? 'bg-neutral-50' : ''}`}
                      >
                        <span className="text-xs text-zinc-400">{taipeiDateTime(entry.occurredAt)}</span>
                        <span className="text-sm text-zinc-600">{entry.typeLabel}</span>
                        <span className="min-w-0 truncate text-sm font-medium text-zinc-900">{entry.content}</span>
                        <span className="text-sm font-semibold text-zinc-900 lg:text-right">{entry.amountLabel}</span>
                        <span className="text-xs text-zinc-500">{entry.paymentMethodLabel}</span>
                        <span>
                          <span className={`rounded-full px-2 py-1 text-xs ${statusClass(entry.statusTone)}`}>
                            {entry.statusLabel}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {tab === 'refill' ? (
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                <div className="grid grid-cols-[minmax(120px,1fr)_90px_90px_120px] gap-3 border-b border-neutral-100 px-4 py-3 text-xs font-medium text-zinc-400 md:grid-cols-[160px_minmax(120px,1fr)_100px_100px_140px]">
                  <span>換罐單</span>
                  <span className="hidden md:block">客人</span>
                  <span>換罐費</span>
                  <span>補差額</span>
                  <span>結算</span>
                </div>
                {ledger.refillRows.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-zinc-500">這個期間沒有換罐資料。</p>
                ) : (
                  ledger.refillRows.map((row, index) => (
                    <div
                      key={row.refillOrderId}
                      className={`grid grid-cols-[minmax(120px,1fr)_90px_90px_120px] gap-3 px-4 py-3 text-sm md:grid-cols-[160px_minmax(120px,1fr)_100px_100px_140px] ${
                        index === 0 ? '' : 'border-t border-neutral-100'
                      }`}
                    >
                      <span className="truncate font-medium text-zinc-900">{row.refillDisplay}</span>
                      <span className="hidden truncate text-zinc-500 md:block">{row.customerName}</span>
                      <span className="text-zinc-700">{row.refillFee == null ? '—' : formatNtd(row.refillFee)}</span>
                      <span className="text-zinc-700">{row.surcharge == null ? '—' : formatNtd(row.surcharge)}</span>
                      <span className="text-zinc-500">{row.settlementLabel}</span>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <aside className="hidden w-[330px] shrink-0 border-l border-neutral-200 bg-white p-5 md:block">
            <DetailPanel entry={selected} />
          </aside>
        </div>
      </main>

      <InventoryBottomNav />
    </div>
  );
}

export function SettleWorkspaceV2(props: {
  account: PosAccount;
  ledger: StoreLedgerPageData;
}) {
  return (
    <RestockCartProvider>
      <SettleWorkspaceInner {...props} />
    </RestockCartProvider>
  );
}
