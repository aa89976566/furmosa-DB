"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  InventoryBottomNav,
  InventorySideNav,
} from "@/components/pos/inventory-nav";
import { RestockCartProvider } from "@/components/pos/restock-cart-provider";
import { PosAccountMenu } from "@/components/pos/account-menu";
import { JarSerialPanel } from "@/components/pos/jar-serial-panel";
import {
  RefillOrderPanel,
  RefillSuccessPanel,
} from "@/components/pos/refill-order-panel";
import type { PosAccount } from "@/lib/pos/account";
import { mapRefillStaffError } from "@/lib/pos/refill-staff-errors";
import {
  customerInitial,
  refillListHint,
  refillStaffView,
  toPosRefillOrderCard,
  type PosRefillOrderCard,
} from "@/lib/pos/refill-view";

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
  const [prefillOldSerial, setPrefillOldSerial] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    newSerial: string;
    customerName: string;
  } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { processable, unpaid, visible } = useMemo(() => {
    const processableOrders = orders.filter(
      (order) => refillStaffView(order).canFulfill,
    );
    const unpaidOrders = orders.filter(
      (order) => refillStaffView(order).unpaidBlock,
    );
    const combined = [...processableOrders, ...unpaidOrders];
    return {
      processable: processableOrders,
      unpaid: unpaidOrders,
      visible: showAll ? combined : combined.slice(0, LIST_PREVIEW),
    };
  }, [orders, showAll]);

  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const totalCount = processable.length + unpaid.length;

  async function reloadOrders() {
    try {
      const res = await fetch("/api/merchant/refill-orders");
      const data = (await res.json()) as {
        orders?: Parameters<typeof toPosRefillOrderCard>[0][];
      };
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
      const res = await fetch("/api/merchant/refill-orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await res.json()) as {
        orderId?: string;
        serial?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.orderId) {
        setLookupError(mapRefillStaffError(data, "lookup"));
        return;
      }
      await reloadOrders();
      setSelectedId(data.orderId);
      setPrefillOldSerial(data.serial ?? "");
      setSuccess(null);
    } catch {
      setLookupError("找不到這個罐子的換罐資料");
    } finally {
      setBusy(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setPrefillOldSerial("");
    setSuccess(null);
  }

  const detail = success ? (
    <RefillSuccessPanel
      customerName={success.customerName}
      newSerial={success.newSerial}
      onDone={() => {
        showToast(setToast, "換罐完成");
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
          prev.map((order) =>
            order.id === selected.id ? { ...order, ...patch } : order,
          ),
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

        <div className="mx-3 mb-24 mt-3 min-w-0 overflow-hidden rounded-[24px] border-2 border-zinc-900 bg-white shadow-[4px_4px_0_#171717] md:m-6 md:ml-4 md:flex md:h-[calc(100%-3rem)] md:flex-1 md:rounded-[32px] md:shadow-[8px_8px_0_#171717]">
          <main className="min-w-0 flex-1 md:flex md:h-full md:flex-col md:overflow-hidden">
            <header className="flex items-center justify-between px-4 pb-3 pt-5 md:px-6">
              <div>
                <h1 className="text-2xl font-semibold">換罐</h1>
                <p className="mt-1 text-sm text-zinc-500">
                  掃罐底就能找到客人的訂單
                </p>
              </div>
              <div className="md:hidden">
                <PosAccountMenu account={account} />
              </div>
            </header>

            <div className="flex-1 space-y-8 px-4 pb-28 md:overflow-y-auto md:px-6 md:pb-8">
              <section>
                <p className="mb-3 text-sm font-semibold">1. 找到客人的訂單</p>
                <JarSerialPanel
                  variant="cards"
                  primaryLabel="掃描罐底"
                  secondaryLabel="手動輸入序號"
                  primaryHint="掃描空罐底部 QR Code"
                  secondaryHint="輸入罐底序號查詢訂單"
                  submitLabel="查詢"
                  busyLabel="查詢中..."
                  busy={busy}
                  allowAnyQuery
                  onSerial={(value) => void lookup(value)}
                />
                {lookupError ? (
                  <div className="mt-3 space-y-2 border-l-4 border-zinc-900 pl-3">
                    <p className="text-sm font-medium text-zinc-900">
                      {lookupError}
                    </p>
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
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    待換罐客人
                  </h2>
                  <p className="text-xs text-zinc-500">共 {totalCount} 筆</p>
                </div>
                {totalCount === 0 ? (
                  <p className="mt-3 text-sm text-zinc-500">
                    目前沒有待換罐的客人。
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-2xl border-2 border-zinc-900">
                    {visible.map((order) => {
                      const view = refillStaffView(order);
                      const active = selectedId === order.id;
                      const unpaid = view.unpaidBlock;
                      return (
                        <li key={order.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(order.id);
                              setPrefillOldSerial("");
                              setSuccess(null);
                              setLookupError(null);
                            }}
                            className={`flex min-h-[76px] w-full items-center gap-3 bg-white px-4 py-3 text-left transition-colors ${
                              active ? "bg-neutral-100" : "hover:bg-neutral-50"
                            }`}
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-zinc-700">
                              {customerInitial(order.customerName)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">
                                {order.customerName}
                              </p>
                              <p className="mt-0.5 truncate text-sm text-zinc-500">
                                訂單 {view.orderNo}
                              </p>
                            </div>
                            <div className="shrink-0 text-right text-sm">
                              <p
                                className={
                                  unpaid
                                    ? "font-medium text-zinc-900"
                                    : "font-medium text-zinc-700"
                                }
                              >
                                {view.paymentLabel}
                              </p>
                              <p className="mt-0.5 text-zinc-500">
                                {refillListHint(view)}
                              </p>
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
                    className="mt-3 flex w-full items-center justify-center gap-1 py-2 text-sm text-zinc-500"
                    onClick={() => setShowAll(true)}
                  >
                    查看更多
                    <ChevronDown className="h-4 w-4" />
                  </button>
                ) : null}
              </section>
            </div>
          </main>

          <aside className="hidden w-[380px] shrink-0 border-l-2 border-zinc-900 bg-white px-5 py-5 md:block">
            {detail}
          </aside>
        </div>
      </div>

      {selectedId || success ? (
        <div
          className="fixed inset-x-0 top-0 z-50 md:hidden"
          style={{ bottom: "calc(56px + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="關閉"
            onClick={closeDetail}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[92%] flex-col overflow-hidden rounded-t-3xl border-t-2 border-zinc-900 bg-white">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {detail}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border-2 border-zinc-900 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-[4px_4px_0_#171717] md:bottom-8">
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
