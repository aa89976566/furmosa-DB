'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Search, Wallet } from 'lucide-react';
import { InventoryBottomNav, InventorySideNav } from '@/components/pos/inventory-nav';
import { RestockCartProvider } from '@/components/pos/restock-cart-provider';
import type { PosAccount } from '@/lib/pos/account';
import type { StoreLedgerPageData } from '@/lib/pos/load-store-ledger';
import { formatNtd } from '@/lib/pos/store-ledger';
import { confirmStoreSettlementAction } from '@/app/pos/settle/actions';

type SettleTab = 'overview' | 'ledger' | 'refill' | 'history';

const TABS: Array<{ id: SettleTab; label: string }> = [
  { id: 'overview', label: '總覽' },
  { id: 'ledger', label: '交易流水' },
  { id: 'refill', label: '換罐對帳' },
  { id: 'history', label: '結帳紀錄' },
];

const TYPE_FILTERS = ['全部類型', '換罐費', '補差額', '優惠券補貼', '進貨款'] as const;
const STATUS_FILTERS = ['全部狀態', '待結算', '已入帳', '已結清', '暫不列入結算'] as const;
const METHOD_FILTERS = ['全部收款方式', '客人線上付款', '店家收現金', '匠寵補貼', '匠寵出貨'] as const;

function taipeiDay(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function taipeiDateTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function statusClass(tone: string): string {
  if (tone === 'settled') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'pending') return 'bg-orange-50 text-orange-700';
  if (tone === 'alert') return 'bg-red-50 text-red-700';
  return 'bg-neutral-100 text-zinc-600';
}

function SettleWorkspaceInner({
  account,
  ledger,
  from,
  to,
  initialTab,
}: {
  account: PosAccount;
  ledger: StoreLedgerPageData;
  from: string;
  to: string;
  initialTab: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<SettleTab>(
    TABS.some((item) => item.id === initialTab) ? (initialTab as SettleTab) : 'overview',
  );
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>('全部類型');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('全部狀態');
  const [methodFilter, setMethodFilter] = useState<(typeof METHOD_FILTERS)[number]>('全部收款方式');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(ledger.entries[0]?.id ?? null);
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState<'collections' | 'coupons' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState(() => {
    if (ledger.summary.payer === 'FURMOSA') return '匠寵匯款至店家帳戶';
    if (ledger.summary.payer === 'NONE') return '本期無需付款';
    return '銀行轉帳';
  });

  const periodLabel = `${taipeiDay(ledger.periodStart)} – ${taipeiDay(ledger.periodEnd)}`;
  const selected = ledger.entries.find((entry) => entry.id === selectedId) ?? null;
  const couponRows = ledger.entries.filter(
    (entry) => entry.transactionType === 'COUPON_SUBSIDY' && entry.included,
  );
  const collectionRows = ledger.entries.filter(
    (entry) =>
      (entry.transactionType === 'EMPTY_JAR_SURCHARGE' || entry.transactionType === 'STORE_COLLECTION') &&
      entry.included,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ledger.entries.filter((entry) => {
      if (typeFilter !== '全部類型' && entry.typeLabel !== typeFilter) return false;
      if (statusFilter !== '全部狀態' && entry.statusLabel !== statusFilter) return false;
      if (methodFilter !== '全部收款方式' && entry.paymentMethodLabel !== methodFilter) return false;
      if (!q) return true;
      return [
        entry.content,
        entry.relatedOrderDisplay,
        entry.customerName,
        entry.couponCode,
        entry.jarSerial,
        entry.relatedOrderId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [ledger.entries, methodFilter, query, statusFilter, typeFilter]);

  const paymentOptions =
    ledger.summary.payer === 'FURMOSA'
      ? ['匠寵匯款至店家帳戶']
      : ledger.summary.payer === 'NONE'
        ? ['本期無需付款']
        : ['銀行轉帳', '匠寵餘額折抵', '其他已核准方式'];

  async function onConfirm() {
    setBusy(true);
    setMessage(null);
    const result = await confirmStoreSettlementAction({
      from,
      to,
      paymentMethodLabel: paymentMethod,
    });
    setBusy(false);
    setMessage(result.ok ? result.message : result.error);
  }

  const confirmPanel = (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-zinc-400">本次結帳</p>
        <h2 className="mt-1 text-lg font-semibold">確認本期對帳</h2>
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">期間</dt>
          <dd>{periodLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">店家應付匠寵</dt>
          <dd>{formatNtd(ledger.summary.storeOwesFurmosa)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">匠寵應付店家</dt>
          <dd>- {formatNtd(ledger.summary.furmosaOwesStore)}</dd>
        </div>
      </dl>
      <div className="border-t border-neutral-200 pt-4">
        <p className="text-sm text-zinc-500">{ledger.summary.resultLabel}</p>
        <p className={`mt-1 text-2xl font-semibold ${ledger.summary.netAmount === 0 ? 'text-zinc-900' : 'text-orange-600'}`}>
          {formatNtd(Math.abs(ledger.summary.netAmount))}
        </p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">付款方式</legend>
        {paymentOptions.map((option) => (
          <label key={option} className="flex min-h-[44px] items-center gap-2 text-sm">
            <input
              type="radio"
              name="settle-method"
              checked={paymentMethod === option}
              onChange={() => setPaymentMethod(option)}
            />
            {option}
          </label>
        ))}
      </fieldset>
      {ledger.summary.payer === 'STORE' ? (
        <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-950">
          客人線上付款給匠寵的換罐費不列入店家匯款。
        </p>
      ) : ledger.summary.payer === 'FURMOSA' ? (
        <p className="rounded-xl bg-neutral-50 px-3 py-3 text-sm text-zinc-600">
          本期是匠寵應匯給店家，店家不必付款。
        </p>
      ) : (
        <p className="rounded-xl bg-neutral-50 px-3 py-3 text-sm text-zinc-600">兩邊應付相抵，本期不用匯款。</p>
      )}
      {message ? <p className="text-sm text-orange-700">{message}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={onConfirm}
        className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy
          ? '處理中…'
          : ledger.summary.payer === 'STORE'
            ? `確認結帳 ${formatNtd(ledger.summary.netAmount)}`
            : '確認結帳'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-zinc-900 text-sm"
      >
        返回
      </button>
    </div>
  );

  const overviewCards = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        title="店家應付匠寵"
        amount={ledger.summary.storeOwesFurmosa}
        hint="進貨款 + 店家代收款"
        icon={<ArrowUp className="h-4 w-4" />}
        iconClass="bg-red-50 text-red-600"
      />
      <SummaryCard
        title="匠寵應付店家"
        amount={ledger.summary.furmosaOwesStore}
        hint="優惠券補貼 + 活動返利"
        icon={<ArrowDown className="h-4 w-4" />}
        iconClass="bg-sky-50 text-sky-700"
      />
      <SummaryCard
        title="已結清"
        amount={ledger.summary.settledAmount}
        hint="不計入本期待結算"
        icon={<Check className="h-4 w-4" />}
        iconClass="bg-emerald-50 text-emerald-700"
      />
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-zinc-500">本期結算結果</p>
            <p className="mt-1 text-xs text-zinc-400">{ledger.summary.resultLabel}</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-600">
            <Wallet className="h-4 w-4" />
          </span>
        </div>
        <p className={`mt-4 text-2xl font-semibold ${ledger.summary.netAmount === 0 ? 'text-zinc-900' : 'text-orange-600'}`}>
          {ledger.summary.netAmount === 0 ? 'NT$0' : formatNtd(Math.abs(ledger.summary.netAmount))}
        </p>
      </div>
    </div>
  );

  const formulaBar = (
    <p className="rounded-xl bg-neutral-100 px-4 py-3 text-sm text-zinc-600">
      店家應付匠寵 {formatNtd(ledger.summary.storeOwesFurmosa)} − 匠寵應付店家{' '}
      {formatNtd(ledger.summary.furmosaOwesStore)} ={' '}
      <span className={ledger.summary.netAmount === 0 ? 'font-semibold text-zinc-900' : 'font-semibold text-orange-600'}>
        {formatNtd(Math.abs(ledger.summary.netAmount))}
      </span>
    </p>
  );

  const breakdown = (
    <div>
      <h2 className="mb-3 text-base font-semibold">本期對帳拆解</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100">
          <h3 className="flex items-center gap-2 font-medium">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-600">
              <ArrowUp className="h-3.5 w-3.5" />
            </span>
            店家應付匠寵
          </h3>
          <BreakdownRow label="進貨款" amount={ledger.summary.restockCost} />
          <button
            type="button"
            className="flex w-full items-center justify-between py-2 text-left text-sm"
            onClick={() => setExpanded(expanded === 'collections' ? null : 'collections')}
          >
            <span>店家代收</span>
            <span>{formatNtd(ledger.summary.storeCollections)}</span>
          </button>
          {expanded === 'collections' ? (
            <ul className="mb-2 space-y-2 rounded-xl bg-neutral-50 p-3 text-sm">
              {collectionRows.length === 0 ? (
                <li className="text-zinc-500">本期沒有店家代收現金。</li>
              ) : (
                collectionRows.map((row) => (
                  <li key={row.id} className="flex flex-col gap-0.5">
                    <span>
                      {taipeiDay(row.occurredAt)} {row.customerName}
                    </span>
                    <span className="text-zinc-500">
                      補差額 {formatNtd(row.amount)} · {row.relatedOrderDisplay}
                    </span>
                  </li>
                ))
              )}
            </ul>
          ) : null}
          {ledger.summary.otherStorePayables > 0 ? (
            <BreakdownRow label="其他店家應回款" amount={ledger.summary.otherStorePayables} />
          ) : null}
          <div className="mt-2 flex justify-between border-t border-neutral-200 pt-3 text-sm font-semibold">
            <span>小計</span>
            <span>{formatNtd(ledger.summary.storeOwesFurmosa)}</span>
          </div>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100">
          <h3 className="flex items-center gap-2 font-medium">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-50 text-sky-700">
              <ArrowDown className="h-3.5 w-3.5" />
            </span>
            匠寵應付店家
          </h3>
          <button
            type="button"
            className="flex w-full items-center justify-between py-2 text-left text-sm"
            onClick={() => setExpanded(expanded === 'coupons' ? null : 'coupons')}
          >
            <span>優惠券補貼</span>
            <span>{formatNtd(ledger.summary.couponSubsidy)}</span>
          </button>
          {expanded === 'coupons' ? (
            <ul className="mb-2 space-y-2 rounded-xl bg-neutral-50 p-3 text-sm">
              {couponRows.length === 0 ? (
                <li className="text-zinc-500">本期沒有優惠券補貼。</li>
              ) : (
                couponRows.map((row) => (
                  <li key={row.id} className="flex flex-col gap-0.5">
                    <span className="font-medium">{row.customerName || '客人'}</span>
                    <span className="text-zinc-500">
                      集點兌換優惠券 {formatNtd(row.amount)}
                      {row.couponCode ? ` · ${row.couponCode}` : ''}
                    </span>
                    {row.relatedOrderDisplay ? (
                      <span className="text-zinc-400">關聯訂單 {row.relatedOrderDisplay}</span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          ) : null}
          <BreakdownRow label="活動返利" amount={ledger.summary.rebates} />
          <BreakdownRow label="其他調整" amount={ledger.summary.otherFurmosaPayables} />
          <div className="mt-2 flex justify-between border-t border-neutral-200 pt-3 text-sm font-semibold">
            <span>小計</span>
            <span>{formatNtd(ledger.summary.furmosaOwesStore)}</span>
          </div>
        </section>
      </div>
    </div>
  );

  const ledgerTable = (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-neutral-100">
      <table className="min-w-[860px] w-full text-left text-sm">
        <thead className="text-xs text-zinc-400">
          <tr>
            {['時間', '類型', '內容', '金額', '收款方式', '款項方向', '狀態', '關聯單號'].map((col) => (
              <th key={col} className="px-3 py-3 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-zinc-500">
                這段期間沒有符合的流水。
              </td>
            </tr>
          ) : (
            filtered.map((entry) => {
              const active = entry.id === selectedId;
              return (
                <tr
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  className={`cursor-pointer border-t border-neutral-100 ${
                    active ? 'bg-orange-50/70' : 'hover:bg-neutral-50'
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-3">{taipeiDateTime(entry.occurredAt)}</td>
                  <td className="px-3 py-3">{entry.typeLabel}</td>
                  <td className="px-3 py-3">{entry.content}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatNtd(entry.amount)}</td>
                  <td className="px-3 py-3">{entry.paymentMethodLabel}</td>
                  <td className="px-3 py-3">{entry.fundDirectionLabel}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(entry.statusTone)}`}>
                      {entry.statusLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{entry.relatedOrderDisplay}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const refillTable = (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-neutral-100">
      <table className="min-w-[920px] w-full text-left text-sm">
        <thead className="text-xs text-zinc-400">
          <tr>
            {['換罐訂單', '客人', '換罐費', '付款方', '補差額', '優惠券', '店家代收', '匠寵補貼', '結算狀態'].map(
              (col) => (
                <th key={col} className="px-3 py-3 font-medium">
                  {col}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {ledger.refillRows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                這段期間沒有換罐金流。
              </td>
            </tr>
          ) : (
            ledger.refillRows.map((row) => (
              <tr key={row.refillOrderId} className="border-t border-neutral-100">
                <td className="whitespace-nowrap px-3 py-3">{row.refillDisplay}</td>
                <td className="px-3 py-3">{row.customerName}</td>
                <td className="px-3 py-3">{row.refillFee == null ? '—' : formatNtd(row.refillFee)}</td>
                <td className="px-3 py-3">{row.refillFeeCollectorLabel ?? '—'}</td>
                <td className="px-3 py-3">{row.surcharge == null ? '—' : formatNtd(row.surcharge)}</td>
                <td className="px-3 py-3">{row.coupon == null ? '—' : formatNtd(row.coupon)}</td>
                <td className="px-3 py-3">{formatNtd(row.storeCollected)}</td>
                <td className="px-3 py-3">{formatNtd(row.furmosaSubsidy)}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      row.unpaid ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'
                    }`}
                  >
                    {row.settlementLabel}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const historyPanel = (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-100">
      <h2 className="text-base font-semibold">結帳紀錄</h2>
      <p className="mt-2 text-sm text-zinc-500">
        目前還沒有店家對帳結算表，所以還不能留下每次結帳快照。數字可以先對，確認結帳不會改流水狀態。
      </p>
    </div>
  );

  const rightPanel = confirming ? (
    confirmPanel
  ) : tab === 'ledger' && selected ? (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-zinc-400">所選流水明細</p>
        <h2 className="mt-1 text-lg font-semibold">{selected.typeLabel}</h2>
      </div>
      <dl className="space-y-2 text-sm">
        {selected.customerName ? (
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">客人</dt>
            <dd>{selected.customerName}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">關聯單號</dt>
          <dd>{selected.relatedOrderDisplay || '—'}</dd>
        </div>
        {selected.couponCode ? (
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">優惠券</dt>
            <dd>{selected.couponCode}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">金額</dt>
          <dd className="font-semibold">{formatNtd(selected.amount)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">款項方向</dt>
          <dd>{selected.fundDirectionLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">狀態</dt>
          <dd>
            <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(selected.statusTone)}`}>
              {selected.statusLabel}
            </span>
          </dd>
        </div>
      </dl>
      {selected.remark ? <p className="rounded-xl bg-neutral-50 px-3 py-3 text-sm text-zinc-600">{selected.remark}</p> : null}
      <p className="text-xs text-zinc-400">金流方向由系統依交易類型決定，店員不能改。</p>
    </div>
  ) : (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-zinc-400">本次結帳</p>
        <h2 className="mt-1 text-lg font-semibold">{periodLabel}</h2>
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">店家應付匠寵</dt>
          <dd>{formatNtd(ledger.summary.storeOwesFurmosa)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">匠寵應付店家</dt>
          <dd>{formatNtd(ledger.summary.furmosaOwesStore)}</dd>
        </div>
      </dl>
      <div className="border-t border-neutral-200 pt-4">
        <p className="text-sm text-zinc-500">{ledger.summary.resultLabel}</p>
        <p className={`mt-1 text-2xl font-semibold ${ledger.summary.netAmount === 0 ? 'text-zinc-900' : 'text-orange-600'}`}>
          {formatNtd(Math.abs(ledger.summary.netAmount))}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          setConfirming(true);
          setMessage(null);
        }}
        className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-zinc-900 text-sm font-medium text-white"
      >
        進行結帳
      </button>
      <section className="rounded-2xl bg-neutral-50 p-4 text-sm text-zinc-600">
        <h3 className="mb-2 font-medium text-zinc-900">對帳規則</h3>
        <ol className="list-decimal space-y-2 pl-4">
          <li>客人線上付款：匠寵已收，不需店家回匯。</li>
          <li>店家代收現金：需列入本期匯回匠寵。</li>
          <li>優惠券折抵：由匠寵補給店家，獨立一筆流水。</li>
        </ol>
      </section>
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-neutral-50 md:flex-row">
      <InventorySideNav account={account} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-neutral-200 bg-white px-4 py-4 md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">結帳</h1>
              <p className="mt-1 text-sm text-zinc-500">對帳本期店家與匠寵的應收應付</p>
            </div>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const nextFrom = String(data.get('from') || from);
                const nextTo = String(data.get('to') || to);
                router.push(`/pos/settle?from=${nextFrom}&to=${nextTo}&tab=${tab}`);
              }}
            >
              <label className="text-xs text-zinc-500">
                期間
                <input
                  type="date"
                  name="from"
                  defaultValue={from}
                  className="mt-1 block min-h-[40px] rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-500">
                到
                <input
                  type="date"
                  name="to"
                  defaultValue={to}
                  className="mt-1 block min-h-[40px] rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-500">
                店家
                <input
                  readOnly
                  value={ledger.storeLabel}
                  className="mt-1 block min-h-[40px] rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-zinc-700"
                />
              </label>
              <button
                type="submit"
                className="min-h-[40px] rounded-xl border border-zinc-900 px-4 text-sm"
              >
                套用
              </button>
            </form>
          </div>
          <div className="mt-4 flex gap-1 overflow-x-auto">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setConfirming(false);
                }}
                className={`min-h-[40px] whitespace-nowrap rounded-full px-4 text-sm ${
                  tab === item.id ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-neutral-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-28 md:px-6 md:pb-8">
          {tab === 'overview' ? (
            <div className="space-y-4">
              {overviewCards}
              {formulaBar}
              {breakdown}
              {ledger.amountNotes.length > 0 ? (
                <ul className="space-y-1 text-xs text-zinc-400">
                  {ledger.amountNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {tab === 'ledger' ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-neutral-100 md:flex-row md:items-center">
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as (typeof TYPE_FILTERS)[number])}
                  className="min-h-[40px] rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                >
                  {TYPE_FILTERS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as (typeof STATUS_FILTERS)[number])}
                  className="min-h-[40px] rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                >
                  {STATUS_FILTERS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <select
                  value={methodFilter}
                  onChange={(event) => setMethodFilter(event.target.value as (typeof METHOD_FILTERS)[number])}
                  className="min-h-[40px] rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                >
                  {METHOD_FILTERS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <label className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜尋訂單編號、序號或客人"
                    className="min-h-[40px] w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm"
                  />
                </label>
              </div>
              {ledgerTable}
            </div>
          ) : null}

          {tab === 'refill' ? refillTable : null}
          {tab === 'history' ? historyPanel : null}
        </div>
      </main>

      <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-neutral-200 bg-white px-5 py-5 md:block">
        {rightPanel}
      </aside>

      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 px-4 md:hidden">
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
            setMessage(null);
          }}
          className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-zinc-900 text-sm font-medium text-white shadow-lg"
        >
          進行結帳
        </button>
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="關閉" onClick={() => setConfirming(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white px-5 py-5">
            {confirmPanel}
          </div>
        </div>
      ) : null}

      <InventoryBottomNav />
    </div>
  );
}

function SummaryCard({
  title,
  amount,
  hint,
  icon,
  iconClass,
}: {
  title: string;
  amount: number;
  hint: string;
  icon: ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100">
      <div className="flex items-start justify-between">
        <p className="text-sm text-zinc-500">{title}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${iconClass}`}>{icon}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold text-zinc-900">{formatNtd(amount)}</p>
      <p className="mt-1 text-xs text-zinc-400">{hint}</p>
    </div>
  );
}

function BreakdownRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span>{label}</span>
      <span>{formatNtd(amount)}</span>
    </div>
  );
}

export function SettleWorkspace({
  account,
  ledger,
  from,
  to,
  initialTab,
}: {
  account: PosAccount;
  ledger: StoreLedgerPageData;
  from: string;
  to: string;
  initialTab: string;
}) {
  return (
    <RestockCartProvider>
      <SettleWorkspaceInner
        account={account}
        ledger={ledger}
        from={from}
        to={to}
        initialTab={initialTab}
      />
    </RestockCartProvider>
  );
}
