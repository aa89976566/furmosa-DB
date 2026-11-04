"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, ChevronRight, CircleCheck, History, Loader2, PackageOpen, ShoppingBag } from "lucide-react";
import { InventoryBottomNav, InventorySideNav } from "@/components/pos/inventory-nav";
import { RestockCartProvider } from "@/components/pos/restock-cart-provider";
import { PosPageTools } from "@/components/pos/page-tools";
import type { PosAccount } from "@/lib/pos/account";
import type { MerchantRefillDashboard, MerchantRefillTransaction } from "@/lib/refill/merchant-dashboard";

function SummaryCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-2xl border border-[#dce8e1] bg-white px-4 py-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold text-[#174733]">{value}</p>{note ? <p className="mt-1 text-xs text-zinc-500">{note}</p> : null}</div>;
}

function TransactionDetail({ item }: { item: MerchantRefillTransaction }) {
  return (
    <section className="rounded-[24px] border border-[#dce8e1] bg-white p-5 md:sticky md:top-5">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium text-[#2e7d4f]">LINE 已入點</p><h2 className="mt-1 text-xl font-semibold">{item.customerName}</h2>{item.petName ? <p className="mt-1 text-sm text-zinc-500">毛孩：{item.petName}</p> : null}</div><CircleCheck className="h-7 w-7 text-[#2e7d4f]" /></div>
      <dl className="mt-5 divide-y divide-neutral-100 text-sm">
        <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">完成時間</dt><dd>{item.occurredAtLabel}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">商品</dt><dd className="text-right">{item.productName}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">序號</dt><dd>{item.codeMasked}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">本次點數</dt><dd className="font-semibold text-[#174733]">+{item.points} 點</dd></div>
      </dl>
      <p className="mt-4 rounded-xl bg-[#f2f7f4] px-4 py-3 text-xs leading-5 text-zinc-600">此紀錄由會員在匠寵官方 LINE 輸入 8 位序號後自動建立，店家不需要代為輸入。</p>
    </section>
  );
}

type PendingOrder = MerchantRefillDashboard["pendingOrders"][number];

function DeliveryWorkspace({ dashboard }: { dashboard: MerchantRefillDashboard }) {
  const router = useRouter();
  const orders = dashboard.pendingOrders;
  const [selectedId, setSelectedId] = useState(orders[0]?.id ?? null);
  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const firstAvailable = dashboard.inventory.find((item) => item.isAvailable && item.quantity > 0);
  const [flavourId, setFlavourId] = useState(firstAvailable?.flavourId ?? "");
  const [quantity, setQuantity] = useState(1);
  const [emptyJarConfirmed, setEmptyJarConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setEmptyJarConfirmed(false);
    setQuantity(1);
    setMessage(null);
  }, [selectedId]);

  async function completeDelivery() {
    if (!selected || !flavourId) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/merchant/refill-orders/${selected.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flavourId, quantity, emptyJarConfirmed }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "交付失敗，請重新整理後再試。");
      setMessage("交付完成，庫存與對帳已同步更新。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "交付失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMissingJar(choice: "keep" | "topup") {
    if (!selected) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/merchant/refill-orders/${selected.id}/mark-missing-container`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "處理失敗，請重新整理後再試。");
      setMessage(choice === "keep" ? "已保留訂單，客人下次帶空罐再領取。" : "已建立 NT$30 補差額，請客人回官方 LINE 完成付款。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "處理失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  if (!orders.length) {
    return <section className="rounded-[24px] border border-[#dce8e1] bg-white px-5 py-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf3ed] text-[#2e7d4f]"><ShoppingBag className="h-5 w-5" /></span><div><h2 className="font-semibold">到店交付確認</h2><p className="text-sm text-zinc-500">目前沒有需要店員確認交付的訂單。</p></div></div></section>;
  }

  const needsEmptyJar = selected?.deliveryMode !== "first" && selected?.orderType !== "first";
  const awaitingTopup = selected?.status === "awaiting_extra_payment";
  const canSubmit = Boolean(selected && flavourId && quantity > 0 && !awaitingTopup && (!needsEmptyJar || emptyJarConfirmed));

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#cfe0d6] bg-white">
      <div className="border-b border-neutral-100 px-5 py-4"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold text-[#174733]">到店交付確認 <span className="ml-1 rounded-full bg-[#eaf3ed] px-2.5 py-1 text-sm">{orders.length}</span></h2><p className="mt-1 text-sm text-zinc-500">只處理已付款的待領訂單；店員核對會員、空罐與實際交付商品。</p></div></div></div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,.8fr)]">
        <ul className="divide-y divide-neutral-100 border-b border-neutral-100 lg:border-b-0 lg:border-r">
          {orders.map((order) => (
            <li key={order.id}><button type="button" onClick={() => setSelectedId(order.id)} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4 text-left transition ${selectedId === order.id ? "bg-[#f2f7f4]" : "hover:bg-neutral-50"}`}><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="truncate">{order.customerName}</strong><span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#2e7d4f]">{order.orderType === "first" ? "首罐 NT$129" : "續罐 NT$99"}</span></span><span className="mt-1 block text-sm text-zinc-500">{order.date} {order.time}{order.petName ? ` · ${order.petName}` : ""}</span><span className="mt-1 block text-xs text-zinc-500">{order.productLabel}</span></span><span className="self-center text-sm font-medium text-[#174733]">{order.status === "awaiting_extra_payment" ? "等待補差額" : "待交付"}</span></button></li>
          ))}
        </ul>
        {selected ? <div className="space-y-4 p-5"><ol aria-label="到店交付確認步驟" className="grid grid-cols-2 gap-2 text-xs text-zinc-600 sm:grid-cols-4"><li className="rounded-lg bg-[#f2f7f4] px-3 py-2"><strong className="block text-[#174733]">1 核對會員</strong>姓名與毛孩</li><li className="rounded-lg bg-[#f2f7f4] px-3 py-2"><strong className="block text-[#174733]">2 核對方式</strong>首罐或續罐</li><li className="rounded-lg bg-[#f2f7f4] px-3 py-2"><strong className="block text-[#174733]">3 核對商品</strong>口味與數量</li><li className="rounded-lg bg-[#f2f7f4] px-3 py-2"><strong className="block text-[#174733]">4 完成交付</strong>扣庫存留紀錄</li></ol><div><p className="text-xs font-medium text-[#2e7d4f]">本次領取人</p><h3 className="mt-1 text-lg font-semibold">{selected.customerName}{selected.petName ? ` · ${selected.petName}` : ""}</h3><p className="mt-1 text-sm text-zinc-500">{selected.orderType === "first" ? "第一罐 NT$129，不需繳回空罐" : "續罐 NT$99，需確認收到實體空罐"}</p></div>
          {awaitingTopup ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">客人未帶空罐，正在等待補付 NT$30；付款完成後才能交付。</p> : null}
          <label className="block text-sm font-medium">實際交付品項<select value={flavourId} onChange={(event) => setFlavourId(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 font-normal"><option value="">請選擇品項</option>{dashboard.inventory.filter((item) => item.isAvailable && item.quantity > 0).map((item) => <option key={item.flavourId} value={item.flavourId}>{item.name} {item.weightGrams}g（庫存 {item.quantity}）</option>)}</select></label>
          <label className="block text-sm font-medium">數量<input type="number" min={1} max={20} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-3 font-normal" /></label>
          {needsEmptyJar ? <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#cfe0d6] bg-[#f2f7f4] px-4 py-3"><input type="checkbox" checked={emptyJarConfirmed} onChange={(event) => setEmptyJarConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#2e7d4f]" /><span><strong className="block text-sm">已收到客人的實體空罐</strong><span className="mt-1 block text-xs leading-5 text-zinc-500">只核對實物，不輸入或掃描舊罐序號。</span></span></label> : null}
          {needsEmptyJar && !emptyJarConfirmed && !awaitingTopup ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-medium text-amber-950">客人沒有帶空罐？</p><p className="mt-1 text-xs leading-5 text-amber-800">可保留訂單稍後領取，或補 NT$30 改為首罐價 NT$129。</p><div className="mt-3 flex gap-2"><button type="button" disabled={submitting} onClick={() => handleMissingJar("keep")} className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 disabled:opacity-50">保留下次領取</button><button type="button" disabled={submitting} onClick={() => handleMissingJar("topup")} className="flex-1 rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">補付 NT$30</button></div></div> : null}
          {message ? <p aria-live="polite" className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-zinc-700">{message}</p> : null}
          <button type="button" disabled={!canSubmit || submitting} onClick={completeDelivery} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#17613f] px-4 py-3 font-semibold text-white transition hover:bg-[#124e33] disabled:cursor-not-allowed disabled:bg-zinc-300">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}{submitting ? "正在完成交付與扣除庫存…" : "確認交付並扣除庫存"}</button>
          <p className="text-xs leading-5 text-zinc-500">完成後會自動扣除本店庫存並留下交付與庫存異動紀錄；只有店家代收的款項才會進入店家對帳。客人拿到新罐後，自行在官方 LINE 輸入新序號取得點數。</p>
        </div> : null}
      </div>
    </section>
  );
}

function RefillWorkspaceInner({ account, dashboard }: { account: PosAccount; dashboard: MerchantRefillDashboard }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(dashboard.transactions[0]?.id ?? null);
  const selected = dashboard.transactions.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    const refresh = () => router.refresh();
    const timer = window.setInterval(refresh, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f7f8f7] text-zinc-900">
      <div className="md:flex md:min-h-screen">
        <InventorySideNav account={account} />
        <main className="min-w-0 flex-1 pb-24 md:pb-10">
          <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-5 md:px-8"><div><p className="text-sm text-zinc-500">店家服務</p><h1 className="mt-1 text-2xl font-semibold text-[#173f2b]">換罐計畫</h1></div><PosPageTools account={account} /></header>
          <div className="mx-auto max-w-[1280px] space-y-5 px-4 py-5 md:px-8 md:py-7">
            <section className="rounded-[24px] border border-[#cfe0d6] bg-[#f2f7f4] p-5 md:flex md:items-center md:justify-between md:gap-6"><div><p className="text-lg font-semibold text-[#174733]">會員自己在 LINE 完成序號登錄</p><p className="mt-2 text-sm leading-6 text-zinc-600">客人加入匠寵官方 LINE 後輸入 8 位數字；HQ 自動入點，本頁只顯示 {dashboard.storeName || "本店"} 的內容與交易紀錄。</p></div><span className="mt-4 inline-flex shrink-0 rounded-full bg-[#2e7d4f] px-4 py-2 text-sm font-medium text-white md:mt-0">LINE 已連線</span></section>
            {!dashboard.storeReady ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">本店尚未完成換罐計畫店家綁定，為避免顯示其他店家資料，交易紀錄已暫時隱藏。請聯絡匠寵客服完成設定。</section> : null}
            <DeliveryWorkspace dashboard={dashboard} />
            <section aria-live="polite" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryCard label={`今日 LINE 入點（${dashboard.summary.todayLabel}）`} value={`${dashboard.summary.today} 筆`} note={`同步於 ${dashboard.summary.updatedAtLabel}`} />
              <SummaryCard label="近 30 日 LINE 入點" value={`${dashboard.summary.last30Days} 筆`} note={`${dashboard.summary.monthLabel}本月共 ${dashboard.summary.thisMonth} 筆`} />
              <SummaryCard label="本店可換庫存" value={`${dashboard.summary.availableStock} 份`} note={dashboard.inventory.length ? "每 30 秒自動同步" : "本店尚未設定可換內容"} />
            </section>
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
              <div className="space-y-5">
                <section className="rounded-[24px] border border-neutral-200 bg-white p-5">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf3ed] text-[#2e7d4f]"><PackageOpen className="h-5 w-5" /></span><div><h2 className="font-semibold">本店換罐內容</h2><p className="text-xs text-zinc-500">{dashboard.plan.flavourUpdateNote}</p></div></div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">{dashboard.inventory.length ? dashboard.inventory.map((stock) => <div key={stock.id} className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3"><div><p className="font-medium">{stock.name}</p><p className="text-xs text-zinc-500">{stock.weightGrams}g</p></div><span className={stock.isAvailable && stock.quantity > 0 ? "text-sm font-semibold text-[#2e7d4f]" : "text-sm text-zinc-400"}>{stock.isAvailable && stock.quantity > 0 ? `${stock.quantity} 份` : "暫無庫存"}</span></div>) : <p className="text-sm text-zinc-500">目前尚未設定本店可換內容。</p>}</div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-neutral-100 pt-4 text-sm text-zinc-600"><span>每罐 +{dashboard.plan.pointsPerJar} 點</span><span>{dashboard.plan.pointsForDiscount} 點折 NT${dashboard.plan.discountAmount}</span><span>換罐價 NT${dashboard.plan.exchangePrice}</span></div>
                </section>
                <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
                  <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4"><History className="h-5 w-5 text-[#2e7d4f]" /><div><h2 className="font-semibold">本店 LINE 交易紀錄</h2><p className="text-xs text-zinc-500">最新 100 筆，只顯示本店會員交易</p></div></div>
                  {dashboard.transactions.length ? <ul className="divide-y divide-neutral-100">{dashboard.transactions.map((item) => <li key={item.id}><button type="button" onClick={() => setSelectedId(item.id)} className={`grid w-full grid-cols-[74px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 text-left transition ${selectedId === item.id ? "bg-[#f2f7f4]" : "hover:bg-neutral-50"}`}><span className="text-sm text-zinc-500">{item.occurredAtLabel}</span><span className="min-w-0"><strong className="block truncate font-medium">{item.customerName}</strong><span className="block truncate text-xs text-zinc-500">{item.productName} · {item.codeMasked}</span></span><span className="flex items-center gap-2 font-semibold text-[#2e7d4f]">+{item.points} 點<ChevronRight className="h-4 w-4" /></span></button></li>)}</ul> : <div className="px-5 py-12 text-center"><Box className="mx-auto h-8 w-8 text-zinc-300" /><p className="mt-3 text-sm text-zinc-500">本店目前還沒有 LINE 換罐交易。</p></div>}
                </section>
              </div>
              <div>{selected ? <TransactionDetail item={selected} /> : null}</div>
            </section>
          </div>
        </main>
      </div>
      <InventoryBottomNav />
    </div>
  );
}

export function RefillWorkspace(props: { account: PosAccount; dashboard: MerchantRefillDashboard }) {
  return <RestockCartProvider><RefillWorkspaceInner {...props} /></RestockCartProvider>;
}
