'use client';

import { useMemo, useState } from 'react';
import { InventoryBottomNav, InventorySideNav } from '@/components/pos/inventory-nav';
import { RestockCartProvider } from '@/components/pos/restock-cart-provider';
import { PosAccountMenu } from '@/components/pos/account-menu';
import { JarSerialPanel } from '@/components/pos/jar-serial-panel';
import { RefillOrderPanel, RefillSuccessPanel } from '@/components/pos/refill-order-panel';
import type { PosAccount } from '@/lib/pos/account';
import { mapRefillStaffError } from '@/lib/pos/refill-staff-errors';
import { refillStaffView, toPosRefillOrderCard, type PosRefillOrderCard } from '@/lib/pos/refill-view';

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
  const [success, setSuccess] = useState<{ newSerial: string; customerName: string } | null>(
    null,
  );

  const pending = useMemo(
    () =>
      orders.filter((order) => {
        const view = refillStaffView(order);
        return view.canFulfill;
      }),
    [orders],
  );
  const selected = orders.find((order) => order.id === selectedId) ?? null;

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
      setLookupError('找不到這個罐子的換罐資料');
    } finally {
      setBusy(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setPrefillOldSerial('');
    setSuccess(null);
  }

  const detail = success ? (
    <RefillSuccessPanel
      customerName={success.customerName}
      newSerial={success.newSerial}
      onDone={() => {
        showToast(setToast, '換罐完成');
        closeDetail();
      }}
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
        setSuccess(payload);
      }}
      onToast={(text) => showToast(setToast, text)}
    />
  ) : (
    <p className="pt-8 text-sm text-zinc-500">掃罐底或點選待換罐客人</p>
  );

  return (
    <div className="min-h-screen bg-neutral-100 text-zinc-900 md:h-screen md:overflow-hidden">
      <div className="md:flex md:h-full">
        <InventorySideNav account={account} />

        <main className="min-w-0 flex-1 md:flex md:h-full md:flex-col md:overflow-hidden">
          <header className="flex items-center justify-between px-4 pb-3 pt-5 md:px-6">
            <div>
              <h1 className="text-2xl font-semibold">換罐</h1>
              <p className="mt-1 text-sm text-zinc-500">掃罐底就能找到客人的訂單</p>
            </div>
            <div className="md:hidden">
              <PosAccountMenu account={account} />
            </div>
          </header>

          <div className="flex-1 space-y-6 px-4 pb-28 md:overflow-y-auto md:px-6 md:pb-8">
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold">1. 找到客人的訂單</p>
              <JarSerialPanel
                primaryLabel="掃描罐底"
                secondaryLabel="手動輸入序號"
                submitLabel="查詢"
                busyLabel="查詢中..."
                busy={busy}
                allowAnyQuery
                onSerial={(value) => void lookup(value)}
              />
              {lookupError ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-red-600">{lookupError}</p>
                  <button
                    type="button"
                    className="text-sm text-zinc-600 underline"
                    onClick={() => setLookupError(null)}
                  >
                    重新輸入
                  </button>
                </div>
              ) : null}
            </section>

            <section>
              <h2 className="text-sm font-semibold text-zinc-900">待換罐</h2>
              {pending.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">目前沒有待換罐的客人。</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {pending.map((order) => {
                    const view = refillStaffView(order);
                    const active = selectedId === order.id;
                    return (
                      <li key={order.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(order.id);
                            setPrefillOldSerial('');
                            setSuccess(null);
                            setLookupError(null);
                          }}
                          className={`flex min-h-[72px] w-full items-start justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-sm ${
                            active ? 'ring-1 ring-zinc-900' : ''
                          }`}
                        >
                          <div>
                            <p className="font-medium">{order.customerName}</p>
                            <p className="mt-0.5 text-sm text-zinc-500">訂單 {view.orderNo}</p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-medium text-zinc-900">{view.paymentLabel}</p>
                            <p className="mt-0.5 text-zinc-500">{view.progressLabel}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </main>

        <aside className="hidden w-[360px] shrink-0 border-l border-neutral-200 bg-white px-5 py-5 md:block">
          {detail}
        </aside>
      </div>

      {selectedId || success ? (
        <div className="fixed inset-x-0 top-0 z-50 md:hidden" style={{ bottom: 'calc(56px + env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="關閉"
            onClick={closeDetail}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[92%] overflow-y-auto rounded-t-3xl bg-white px-5 py-5">
            {detail}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-8">
          {toast}
        </div>
      ) : null}

      <InventoryBottomNav />
    </div>
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
    <RestockCartProvider>
      <RefillWorkspaceInner
        account={account}
        initialOrders={initialOrders}
        initialOrderId={initialOrderId}
        payQrUrl={payQrUrl}
      />
    </RestockCartProvider>
  );
}
