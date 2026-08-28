'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Eye, Search, Wallet } from 'lucide-react';
import { InventoryBottomNav, InventorySideNav } from '@/components/pos/inventory-nav';
import { RestockCartProvider } from '@/components/pos/restock-cart-provider';
import type { PosAccount } from '@/lib/pos/account';
import type { StoreLedgerPageData } from '@/lib/pos/load-store-ledger';
import { formatNtd, type LedgerEntryView } from '@/lib/pos/store-ledger';
import { confirmStoreSettlementAction } from '@/app/pos/settle/actions';

type SettleTab = 'overview' | 'ledger' | 'refill' | 'history';

const TABS: Array<{ id: SettleTab; label: string }> = [
  { id: 'overview', label: '總覽' },
  { id: 'ledger', label: '交易流水' },
  { id: 'refill', label: '換罐對帳' },
  { id: 'history', label: '結帳紀錄' },
];

const TYPE_FILTERS = ['全部類型', '換罐費收入', '補差額代收', '優惠券補貼', '進貨款'] as const;
const STATUS_FILTERS = ['全部狀態', '待結算', '已入帳', '已結清', '暫不列入結算'] as const;
const METHOD_FILTERS = ['全部收款方式', '客人線上付款', '店家代收現金', '匠寵補貼', '匠寵出貨'] as const;
const PAGE_SIZE = 8;

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

function draftSettlementNo(periodEndIso: string): string {
  const parts = taipeiDay(periodEndIso).split('/');
  const stamp = `${parts[0]?.slice(2) ?? '00'}${parts[1] ?? '00'}${parts[2] ?? '00'}`;
  return `ST-${stamp}-預覽`;
}

function statusClass(tone: string): string {
  if (tone === 'settled') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'pending') return 'bg-orange-50 text-orange-700';
  if (tone === 'alert') return 'bg-red-50 text-red-700';
  return 'bg-neutral-100 text-zinc-600';
}

function amountClass(label: string): string {
  if (label.startsWith('-')) return 'text-red-600';
  if (label.startsWith('+')) return 'text-emerald-600';
  return 'text-zinc-900';
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
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(ledger.entries[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState(() => {
    if (ledger.summary.payer === 'FURMOSA') return '匠寵匯款至店家帳戶';
    if (ledger.summary.payer === 'NONE') return '本期無需付款';
    return '銀行轉帳（店家匯回匠寵）';
  });

  const periodLabel = `${taipeiDay(ledger.periodStart)} - ${taipeiDay(ledger.periodEnd)}`;
  const selected = ledger.entries.find((entry) => entry.id === selectedId) ?? null;
  const surchargeRows = ledger.entries.filter(
    (entry) => entry.transactionType === 'EMPTY_JAR_SURCHARGE' && entry.included,
  );
  const otherCollectionRows = ledger.entries.filter(
    (entry) => entry.transactionType === 'STORE_COLLECTION' && entry.included,
  );
  const couponRows = ledger.entries.filter(
    (entry) => entry.transactionType === 'COUPON_SUBSIDY' && entry.included,
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const paymentOptions =
    ledger.summary.payer === 'FURMOSA'
      ? ['匠寵匯款至店家帳戶']
      : ledger.summary.payer === 'NONE'
        ? ['本期無需付款']
        : ['銀行轉帳（店家匯回匠寵）', '匠寵餘額折抵'];

  const refillSummary = useMemo(() => {
    const fees = ledger.refillRows.filter((row) => row.refillFee && !row.unpaid);
    const extras = ledger.refillRows.filter((row) => row.surcharge);
    const coupons = ledger.refillRows.filter((row) => row.coupon);
    const furmosaFees = fees.reduce((sum, row) => sum + (row.refillFee ?? 0), 0);
    const storeExtras = extras.reduce((sum, row) => sum + row.storeCollected, 0);
    const furmosaExtras = extras.reduce(
      (sum, row) => sum + Math.max(0, (row.surcharge ?? 0) - row.storeCollected),
      0,
    );
    const subsidy = coupons.reduce((sum, row) => sum + (row.coupon ?? 0), 0);
    return [
      {
        item: '換罐費',
        unit: fees[0]?.refillFee ? formatNtd(fees[0].refillFee) : '—',
        count: fees.length,
        furmosa: furmosaFees,
        store: 0,
        method: '客人線上付款',
        status: '匠寵已收',
        tone: 'settled' as const,
      },
      {
        item: '補差額代收',
        unit: extras[0]?.surcharge ? formatNtd(extras[0].surcharge) : '—',
        count: extras.length,
        furmosa: furmosaExtras,
        store: storeExtras,
        method: storeExtras > 0 ? '店家代收現金' : '客人線上付款',
        status: storeExtras > 0 ? '待匯回匠寵' : furmosaExtras > 0 ? '匠寵已收' : '—',
        tone: storeExtras > 0 ? ('pending' as const) : ('settled' as const),
      },
      {
        item: '集點兌換優惠券',
        unit: coupons[0]?.coupon ? formatNtd(coupons[0].coupon) : '—',
        count: coupons.length,
        furmosa: 0,
        store: subsidy,
        method: '匠寵補貼',
        status: subsidy > 0 ? '待補給店家' : '—',
        tone: subsidy > 0 ? ('pending' as const) : ('neutral' as const),
      },
    ];
  }, [ledger.refillRows]);

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

  function applyPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextFrom = String(data.get('from') || from);
    const nextTo = String(data.get('to') || to);
    router.push(`/pos/settle?from=${nextFrom}&to=${nextTo}&tab=${tab}`);
  }

  const subtitle =
    tab === 'ledger' || tab === 'refill'
      ? '查看流水、換罐收款與優惠券補貼明細'
      : '對帳本期店家與匠寵的應收應付';

  const periodStoreFilter = (
    <form className="flex flex-wrap items-end gap-3" onSubmit={applyPeriod}>
      <label className="text-xs text-zinc-500">
        期間
        <span className="mt-1 flex min-h-[40px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-zinc-800">
          <input type="date" name="from" defaultValue={from} className="bg-transparent outline-none" />
          <span className="text-zinc-400">-</span>
          <input type="date" name="to" defaultValue={to} className="bg-transparent outline-none" />
        </span>
      </label>
      <label className="text-xs text-zinc-500">
        店家
        <input
          readOnly
          value={ledger.storeLabel}
          className="mt-1 block min-h-[40px] min-w-[160px] rounded-xl border border-neutral-200 bg-white px-3 text-sm text-zinc-800"
        />
      </label>
      <button type="submit" className="min-h-[40px] rounded-xl border border-zinc-900 px-4 text-sm">
        套用
      </button>
    </form>
  );

  const overviewRight = (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-100">
        <h2 className="text-base font-semibold">本次結帳</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">結算單號</dt>
            <dd>{draftSettlementNo(ledger.periodEnd)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">期間</dt>
            <dd>{periodLabel}</dd>
          </div>
        </dl>
        <fieldset className="mt-5 space-y-2">
          <legend className="mb-2 text-sm font-medium">結帳方式</legend>
          {paymentOptions.map((option) => (
            <label key={option} className="flex min-h-[44px] items-start gap-2 text-sm">
              <input
                type="radio"
                name="settle-method"
                className="mt-1"
                checked={paymentMethod === option}
                onChange={() => setPaymentMethod(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
        {ledger.summary.payer === 'STORE' ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-950">
            客人線上付款給匠寵的換罐費不列入店家匯款。
          </p>
        ) : ledger.summary.payer === 'FURMOSA' ? (
          <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-3 text-sm text-zinc-600">
            本期是匠寵應匯給店家，店家不必付款。
          </p>
        ) : (
          <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-3 text-sm text-zinc-600">兩邊應付相抵，本期不用匯款。</p>
        )}
        {message ? <p className="mt-3 text-sm text-orange-700">{message}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy
            ? '處理中…'
            : ledger.summary.payer === 'NONE'
              ? '確認結帳'
              : `確認結帳 ${formatNtd(Math.abs(ledger.summary.netAmount))}`}
        </button>
      </section>
      <section className="rounded-2xl bg-white p-5 text-sm text-zinc-600 shadow-sm ring-1 ring-neutral-100">
        <h3 className="mb-3 font-medium text-zinc-900">對帳規則</h3>
        <ol className="list-decimal space-y-2 pl-4">
          <li>客人線上付款：匠寵已收，不需店家回匯。</li>
          <li>店家代收現金：需列入本期匯回匠寵。</li>
          <li>優惠券折抵：由匠寵補給店家。</li>
        </ol>
      </section>
    </div>
  );

  const ledgerRight = selected ? (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-100">
        <h2 className="text-base font-semibold">所選流水明細</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <DetailRow label="類型" value={selected.typeLabel} />
          {selected.customerName ? <DetailRow label="客人" value={selected.customerName} /> : null}
          <DetailRow label="關聯單號" value={selected.relatedOrderDisplay || '—'} />
          <DetailRow label="時間" value={taipeiDateTime(selected.occurredAt)} />
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">金額</dt>
            <dd className={`font-semibold ${amountClass(selected.amountLabel)}`}>{selected.amountLabel}</dd>
          </div>
          <DetailRow label="收款方式" value={selected.paymentMethodLabel} />
          <DetailRow label="款項去向" value={selected.fundDirectionLabel} />
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">狀態</dt>
            <dd>
              <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(selected.statusTone)}`}>
                {selected.statusLabel}
              </span>
            </dd>
          </div>
        </dl>
        {selected.remark ? (
          <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-3 text-sm text-zinc-600">{selected.remark}</p>
        ) : null}
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-100">
        <h3 className="text-base font-semibold">可執行動作</h3>
        <fieldset className="mt-4 space-y-2 text-sm">
          <label className="flex min-h-[40px] items-center gap-2">
            <input type="radio" checked={selected.included} readOnly />
            列入本期結算
          </label>
          <label className="flex min-h-[40px] items-center gap-2">
            <input type="radio" checked={!selected.included} readOnly />
            暫不結算
          </label>
        </fieldset>
        <p className="mt-3 text-xs text-zinc-400">金流方向由系統依交易類型決定，店員不能改。</p>
        <button
          type="button"
          disabled
          className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-40"
        >
          {selected.included ? '已列入本期結算' : '這筆不列入本期結算'}
        </button>
      </section>
    </div>
  ) : (
    overviewRight
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f4f4f5] md:flex-row">
      <InventorySideNav account={account} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="bg-transparent px-4 pb-2 pt-5 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900">結帳</h1>
              <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
            </div>
            {tab === 'overview' ? periodStoreFilter : null}
          </div>
          <div className="mt-5 flex gap-6 border-b border-neutral-200">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setPage(1);
                }}
                className={`-mb-px min-h-[40px] whitespace-nowrap pb-2 text-sm ${
                  tab === item.id
                    ? 'border-b-2 border-zinc-900 font-medium text-zinc-900'
                    : 'text-zinc-400 hover:text-zinc-700'
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  title="店家應付匠寵"
                  amount={ledger.summary.storeOwesFurmosa}
                  hint="進貨款 + 店家代收現金"
                  icon={<ArrowUp className="h-4 w-4" />}
                  iconClass="bg-red-50 text-red-500"
                />
                <SummaryCard
                  title="匠寵應付店家"
                  amount={ledger.summary.furmosaOwesStore}
                  hint="優惠券補貼 + 活動返利"
                  icon={<ArrowDown className="h-4 w-4" />}
                  iconClass="bg-sky-50 text-sky-600"
                />
                <SummaryCard
                  title="已結清"
                  amount={ledger.summary.settledAmount}
                  hint="上期已完成，不計入本期"
                  icon={<Check className="h-4 w-4" />}
                  iconClass="bg-emerald-50 text-emerald-600"
                />
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-zinc-500">本期結算結果</p>
                      <p className="mt-1 text-xs text-zinc-400">{ledger.summary.resultLabel}</p>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                      <Wallet className="h-4 w-4" />
                    </span>
                  </div>
                  <p
                    className={`mt-4 text-[28px] font-semibold leading-none ${
                      ledger.summary.netAmount === 0 ? 'text-zinc-900' : 'text-orange-500'
                    }`}
                  >
                    {formatNtd(Math.abs(ledger.summary.netAmount))}
                  </p>
                </div>
              </div>
              <p className="rounded-xl bg-neutral-200/60 px-4 py-3 text-sm text-zinc-600">
                店家應付匠寵 {formatNtd(ledger.summary.storeOwesFurmosa)} − 匠寵應付店家{' '}
                {formatNtd(ledger.summary.furmosaOwesStore)} ={' '}
                <span className={ledger.summary.netAmount === 0 ? 'font-semibold text-zinc-900' : 'font-semibold text-orange-500'}>
                  {formatNtd(Math.abs(ledger.summary.netAmount))}
                </span>
              </p>
              <h2 className="pt-1 text-base font-semibold">本期對帳拆解</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                <section className="rounded-2xl bg-white p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 font-medium">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </span>
                    店家應付匠寵
                  </h3>
                  <BreakdownRow label="進貨款" amount={ledger.summary.restockCost} />
                  <BreakdownRow label="店家代收現金" amount={ledger.summary.storeCollections} />
                  <div className="ml-3 space-y-1 border-l border-neutral-200 pl-3 text-sm text-zinc-500">
                    <NestedRow
                      label={`補差額代收 · ${surchargeRows.length} 筆`}
                      amount={surchargeRows.reduce((sum, row) => sum + row.amount, 0)}
                    />
                    <NestedRow
                      label={`門市代收其他 · ${otherCollectionRows.length} 筆`}
                      amount={otherCollectionRows.reduce((sum, row) => sum + row.amount, 0)}
                    />
                  </div>
                  {surchargeRows.length > 0 ? (
                    <ul className="mt-2 space-y-1 rounded-xl bg-neutral-50 p-3 text-xs text-zinc-500">
                      {surchargeRows.map((row) => (
                        <li key={row.id}>
                          {taipeiDay(row.occurredAt)} {row.customerName} 補差額 {formatNtd(row.amount)} ·{' '}
                          {row.relatedOrderDisplay}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {ledger.summary.otherStorePayables > 0 ? (
                    <BreakdownRow label="其他店家應回款" amount={ledger.summary.otherStorePayables} />
                  ) : null}
                  <div className="mt-3 flex justify-between border-t border-neutral-200 pt-3 text-sm font-semibold">
                    <span>小計</span>
                    <span>{formatNtd(ledger.summary.storeOwesFurmosa)}</span>
                  </div>
                </section>
                <section className="rounded-2xl bg-white p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 font-medium">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </span>
                    匠寵應付店家
                  </h3>
                  <BreakdownRow label="優惠券補貼" amount={ledger.summary.couponSubsidy} />
                  <div className="mb-2 overflow-hidden rounded-xl bg-neutral-50">
                    <table className="w-full text-left text-xs text-zinc-500">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 font-medium">項目</th>
                          <th className="px-3 py-2 font-medium">筆數</th>
                          <th className="px-3 py-2 font-medium">金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-3 pb-2">集點兌換券</td>
                          <td className="px-3 pb-2">{couponRows.length} 筆</td>
                          <td className="px-3 pb-2">{formatNtd(ledger.summary.couponSubsidy)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {couponRows.length > 0 ? (
                    <ul className="mb-2 space-y-1 rounded-xl bg-neutral-50 p-3 text-xs text-zinc-500">
                      {couponRows.map((row) => (
                        <li key={row.id}>
                          {row.customerName || '客人'} 集點兌換優惠券 {formatNtd(row.amount)}
                          {row.couponCode ? ` · ${row.couponCode}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <BreakdownRow label="活動返利" amount={ledger.summary.rebates} />
                  <BreakdownRow label="其他調整" amount={ledger.summary.otherFurmosaPayables} />
                  <div className="mt-3 flex justify-between border-t border-neutral-200 pt-3 text-sm font-semibold">
                    <span>小計</span>
                    <span>{formatNtd(ledger.summary.furmosaOwesStore)}</span>
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {tab === 'ledger' ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm md:flex-row md:flex-wrap md:items-center">
                <select
                  value={typeFilter}
                  onChange={(event) => {
                    setTypeFilter(event.target.value as (typeof TYPE_FILTERS)[number]);
                    setPage(1);
                  }}
                  className="min-h-[40px] rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                >
                  {TYPE_FILTERS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as (typeof STATUS_FILTERS)[number]);
                    setPage(1);
                  }}
                  className="min-h-[40px] rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                >
                  {STATUS_FILTERS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <select
                  value={methodFilter}
                  onChange={(event) => {
                    setMethodFilter(event.target.value as (typeof METHOD_FILTERS)[number]);
                    setPage(1);
                  }}
                  className="min-h-[40px] rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                >
                  {METHOD_FILTERS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <form className="flex min-h-[40px] items-center gap-2 rounded-xl border border-neutral-200 px-3 text-sm" onSubmit={applyPeriod}>
                  <input type="date" name="from" defaultValue={from} className="bg-transparent outline-none" />
                  <span className="text-zinc-400">~</span>
                  <input type="date" name="to" defaultValue={to} className="bg-transparent outline-none" />
                  <button type="submit" className="text-zinc-500">
                    套用
                  </button>
                </form>
                <label className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder="搜尋訂單編號、序號或客人"
                    className="min-h-[40px] w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm"
                  />
                </label>
              </div>
              <LedgerTable
                rows={paged}
                selectedId={selectedId}
                onSelect={setSelectedId}
                total={filtered.length}
                fromIndex={filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
                toIndex={Math.min(currentPage * PAGE_SIZE, filtered.length)}
                page={currentPage}
                pageCount={pageCount}
                onPage={setPage}
              />
              <RefillSummaryTable
                lines={refillSummary}
                periodLabel={periodLabel}
                furmosaTotal={refillSummary.reduce((sum, line) => sum + line.furmosa, 0)}
                storeTotal={refillSummary.reduce((sum, line) => sum + line.store, 0)}
              />
            </div>
          ) : null}

          {tab === 'refill' ? (
            <RefillOrdersTable rows={ledger.refillRows} />
          ) : null}

          {tab === 'history' ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold">結帳紀錄</h2>
              <p className="mt-2 text-sm text-zinc-500">
                目前還沒有店家對帳結算表，所以還不能留下每次結帳快照。數字可以先對，確認結帳不會改流水狀態。
              </p>
            </div>
          ) : null}
        </div>
      </main>

      <aside className="hidden w-[340px] shrink-0 overflow-y-auto bg-transparent px-4 py-5 md:block">
        {tab === 'ledger' ? ledgerRight : overviewRight}
      </aside>

      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 px-4 md:hidden">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-zinc-900 text-sm font-medium text-white shadow-lg"
        >
          {busy ? '處理中…' : `確認結帳 ${formatNtd(Math.abs(ledger.summary.netAmount))}`}
        </button>
      </div>

      <InventoryBottomNav />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right">{value}</dd>
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
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm text-zinc-500">{title}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${iconClass}`}>{icon}</span>
      </div>
      <p className="mt-4 text-[28px] font-semibold leading-none text-zinc-900">{formatNtd(amount)}</p>
      <p className="mt-2 text-xs text-zinc-400">{hint}</p>
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

function NestedRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span>{label}</span>
      <span>{formatNtd(amount)}</span>
    </div>
  );
}

function LedgerTable({
  rows,
  selectedId,
  onSelect,
  total,
  fromIndex,
  toIndex,
  page,
  pageCount,
  onPage,
}: {
  rows: LedgerEntryView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  total: number;
  fromIndex: number;
  toIndex: number;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="text-xs text-zinc-400">
            <tr>
              {['時間', '類型', '內容', '金額', '收款方式', '款項去向', '狀態', '關聯單號', '操作'].map((col) => (
                <th key={col} className="px-3 py-3 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                  這段期間沒有符合的流水。
                </td>
              </tr>
            ) : (
              rows.map((entry) => {
                const active = entry.id === selectedId;
                return (
                  <tr
                    key={entry.id}
                    onClick={() => onSelect(entry.id)}
                    className={`cursor-pointer border-t border-neutral-100 ${
                      active ? 'bg-[#f8f1e8]' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-3">{taipeiDateTime(entry.occurredAt)}</td>
                    <td className="px-3 py-3">{entry.typeLabel}</td>
                    <td className="px-3 py-3">{entry.content}</td>
                    <td className={`whitespace-nowrap px-3 py-3 font-medium ${amountClass(entry.amountLabel)}`}>
                      {entry.amountLabel}
                    </td>
                    <td className="px-3 py-3">{entry.paymentMethodLabel}</td>
                    <td className="px-3 py-3">{entry.fundDirectionLabel}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(entry.statusTone)}`}>
                        {entry.statusLabel}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{entry.relatedOrderDisplay}</td>
                    <td className="px-3 py-3">
                      <Eye className="h-4 w-4 text-zinc-400" aria-hidden />
                      <span className="sr-only">查看明細</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-xs text-zinc-400">
        <p>
          顯示第 {fromIndex} 到 {toIndex} 筆，共 {total} 筆
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="disabled:opacity-40">
            上一頁
          </button>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
            className="disabled:opacity-40"
          >
            下一頁
          </button>
        </div>
      </div>
    </div>
  );
}

function RefillSummaryTable({
  lines,
  periodLabel,
  furmosaTotal,
  storeTotal,
}: {
  lines: Array<{
    item: string;
    unit: string;
    count: number;
    furmosa: number;
    store: number;
    method: string;
    status: string;
    tone: 'settled' | 'pending' | 'neutral';
  }>;
  periodLabel: string;
  furmosaTotal: number;
  storeTotal: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <h2 className="px-4 pt-4 text-base font-semibold">換罐對帳摘要</h2>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="text-xs text-zinc-400">
            <tr>
              {['項目', '單價', '筆數', '匠寵金額', '店家金額', '收款方式', '狀態'].map((col) => (
                <th key={col} className="px-3 py-3 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.item} className="border-t border-neutral-100">
                <td className="px-3 py-3">{line.item}</td>
                <td className="px-3 py-3">{line.unit}</td>
                <td className="px-3 py-3">{line.count} 筆</td>
                <td className="px-3 py-3">{line.furmosa ? formatNtd(line.furmosa) : '—'}</td>
                <td className="px-3 py-3">{line.store ? formatNtd(line.store) : '—'}</td>
                <td className="px-3 py-3">{line.method}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(line.tone)}`}>{line.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-3 text-sm">
        <p className="text-zinc-400">統計期間 {periodLabel}</p>
        <p>
          總計匠寵 <span className="font-semibold">{formatNtd(furmosaTotal)}</span>
          <span className="mx-2 text-zinc-300">|</span>
          總計店家 <span className="font-semibold text-orange-500">{formatNtd(storeTotal)}</span>
        </p>
      </div>
    </section>
  );
}

function RefillOrdersTable({ rows }: { rows: StoreLedgerPageData['refillRows'] }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
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
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                這段期間沒有換罐金流。
              </td>
            </tr>
          ) : (
            rows.map((row) => (
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
