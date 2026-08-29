'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PosShell } from '@/components/pos/pos-shell';
import { PosPageHeader } from '@/components/pos/pos-page-header';
import { JarSerialPanel } from '@/components/pos/jar-serial-panel';
import { RefillOrderPanel, RefillSuccessPanel } from '@/components/pos/refill-order-panel';
import { RefillStageNav } from '@/components/pos/refill-stage-nav';
import type { PosAccount } from '@/lib/pos/account';
import { mapRefillStaffError } from '@/lib/pos/refill-staff-errors';
import {
  customerInitial,
  refillCurrentFlowStage,
  refillKindLabel,
  refillListHint,
  refillPaymentStaffCopy,
  refillStaffView,
  toPosRefillOrderCard,
  type PosRefillOrderCard,
} from '@/lib/pos/refill-view';

const LIST_PREVIEW = 4;

function showToast(setToast: (value: string | null) => void, text: string) {
  setToast(text);
  window.setTimeout(() => setToast(null), 2400);
}

function RefillWorkspaceInner({
  account,
  initialOrders,
  initialOrderId = null,
  payQrUrl,
}: {
  account: PosAccount;
  initialOrders: PosRefillOrderCard[];
  initialOrderId?: string | null;
  payQrUrl: string | null;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedId, setSelectedId] = useState<string | null>(initialOrderId);
  const [prefillOldSerial, setPrefillOldSerial] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    newSerial: string;
    customerName: string;
    amount: number;
  } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { processable, unpaid, visible } = useMemo(() => {
    const processableOrders = orders.filter((order) => refillStaffView(order).canFulfill);
    const unpaidOrders = orders.filter((order) => refillStaffView(order).unpaidBlock);
    const combined = [...processableOrders, ...unpaidOrders];
    return {
      processable: processableOrders,
      unpaid: unpaidOrders,
      visible: showAll ? combined : combined.slice(0, LIST_PREVIEW),
    };
  }, [orders, showAll]);

  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const totalCount = processable.length + unpaid.length;
  const selectedView = selected ? refillStaffView(selected) : null;
  const currentStage = refillCurrentFlowStage({
    hasSelection: Boolean(selected),
    success: Boolean(success),
    unpaidBlock: selectedView?.unpaidBlock ?? false,
    skipOldJar: selectedView?.skipOldJar ?? false,
    oldVerified: selected?.status === 'old_container_verified',
    hasNewSerial: Boolean(selected?.newContainerSerial),
    newConfirmed: Boolean(success || selected?.newContainerSerial),
  });

  async function reloadOrders() {
    try {
      const res = await fetch('/api/merchant/refill-orders');
      const data = (await res.json()) as { orders?: Parameters<typeof toPosRefillOrderCard>[0][] };
      if (Array.isArray(data.orders)) {
        setOrders(data.orders.map(toPosRefillOrderCard));
      }
    } catch {
      /* keep local snapshot */
    }
  }

  async function lookup(query: string) {
    setBusy(true);
    setLookupError(null);
    try {
      const res = await fetch('/api/merchant/refill-orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = (await res.json()) as {
        orderId?: string;
        serial?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.orderId) {
        setLookupError(mapRefillStaffError(data, 'lookup'));
        return;
      }
      await reloadOrders();
      setSelectedId(data.orderId);
      setPrefillOldSerial(data.serial ?? '');
      setSuccess(null);
    } catch {
      setLookupError('連線暫時有問題，請再試一次。');
    } finally {
      setBusy(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setPrefillOldSerial('');
    setSuccess(null);
    setLookupError(null);
  }

  function startNextGuest() {
    closeDetail();
  }

  const working = Boolean(selected || success);

  return (
    <PosShell storeName={account.storeName} account={account}>
      <PosPageHeader
        title="幫客人換罐"
        description="依序確認客人、空罐和新罐資料。"
      />

      <div className="space-y-6 px-4 pb-8 md:px-6">
        <RefillStageNav current={success ? 'confirm' : currentStage} />

        {!working ? (
          <>
            <section>
              <h2 className="text-lg font-semibold text-zinc-900">現在先找到客人</h2>
              <p className="mt-1 text-base text-zinc-600">
                掃描客人帶來的空罐，或從下面名單點選。不用輸入電話。
              </p>
              <div className="mt-4">
                <JarSerialPanel
                  variant="cards"
                  inputId="refill-find-guest"
                  primaryLabel="掃描罐底"
                  secondaryLabel="手動輸入序號"
                  primaryHint="掃描空罐底部 QR Code"
                  secondaryHint="輸入罐底 8 碼或訂單編號"
                  submitLabel="查找客人"
                  busyLabel="查找中…"
                  busy={busy}
                  allowAnyQuery
                  onSerial={(value) => void lookup(value)}
                />
              </div>
              {lookupError ? (
                <div className="mt-3 space-y-2" role="alert">
                  <p className="break-words text-base text-zinc-800">{lookupError}</p>
                  <button
                    type="button"
                    className="text-base text-zinc-700 underline"
                    onClick={() => setLookupError(null)}
                  >
                    重新輸入
                  </button>
                </div>
              ) : null}
            </section>

            <section>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold text-zinc-900">待換罐客人</h2>
                <p className="text-sm text-zinc-500">共 {totalCount} 筆</p>
              </div>
              {totalCount === 0 ? (
                <p className="mt-3 text-base text-zinc-600">目前沒有待換罐的客人。</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {visible.map((order) => {
                    const view = refillStaffView(order);
                    const payment = refillPaymentStaffCopy(order);
                    const unpaid = view.unpaidBlock;
                    return (
                      <li key={order.id}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setSelectedId(order.id);
                            setPrefillOldSerial('');
                            setSuccess(null);
                            setLookupError(null);
                          }}
                          className="flex min-h-[76px] w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-60"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-zinc-700">
                            {customerInitial(order.customerName)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="break-words font-medium">{order.customerName}</p>
                            <p className="mt-0.5 break-words text-sm text-zinc-500">
                              {refillKindLabel(order)} · {refillListHint(view)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right text-sm">
                            <p className="font-medium text-zinc-800">{payment.title}</p>
                            <p className="mt-0.5 text-zinc-500">{unpaid ? '還不能換罐' : '可以換罐'}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {totalCount > LIST_PREVIEW && !showAll ? (
                <button
                  type="button"
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-1 text-base text-zinc-600"
                  onClick={() => setShowAll(true)}
                >
                  查看更多
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </section>
          </>
        ) : success ? (
          <RefillSuccessPanel
            customerName={success.customerName}
            newSerial={success.newSerial}
            amount={success.amount}
            onDone={startNextGuest}
          />
        ) : selected ? (
          <RefillOrderPanel
            order={selected}
            payQrUrl={payQrUrl}
            prefillOldSerial={prefillOldSerial}
            busy={busy}
            onBusy={setBusy}
            onClose={closeDetail}
            onOrderPatch={(patch) =>
              setOrders((prev) =>
                prev.map((order) => (order.id === selected.id ? { ...order, ...patch } : order)),
              )
            }
            onCompleted={(payload) => {
              setOrders((prev) => prev.filter((order) => order.id !== selected.id));
              setSelectedId(null);
              setPrefillOldSerial('');
              setSuccess(payload);
            }}
            onToast={(text) => showToast(setToast, text)}
          />
        ) : null}
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 max-w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 break-words rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-8"
        >
          {toast}
        </div>
      ) : null}
    </PosShell>
  );
}

export function RefillWorkspace({
  account,
  initialOrders,
  initialOrderId = null,
  payQrUrl,
}: {
  account: PosAccount;
  initialOrders: PosRefillOrderCard[];
  initialOrderId?: string | null;
  payQrUrl: string | null;
}) {
  return (
    <RefillWorkspaceInner
      account={account}
      initialOrders={initialOrders}
      initialOrderId={initialOrderId}
      payQrUrl={payQrUrl}
    />
  );
}
