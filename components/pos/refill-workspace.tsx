"use client";

import { useState } from "react";
import { Box, ChevronRight, CircleCheck, History, PackageOpen } from "lucide-react";
import { InventoryBottomNav, InventorySideNav } from "@/components/pos/inventory-nav";
import { RestockCartProvider } from "@/components/pos/restock-cart-provider";
import { PosPageTools } from "@/components/pos/page-tools";
import type { PosAccount } from "@/lib/pos/account";
import type { MerchantRefillDashboard, MerchantRefillTransaction } from "@/lib/refill/merchant-dashboard";

const twDate = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#dce8e1] bg-white px-4 py-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold text-[#174733]">{value}</p></div>;
}

function TransactionDetail({ item }: { item: MerchantRefillTransaction }) {
  return (
    <section className="rounded-[24px] border border-[#dce8e1] bg-white p-5 md:sticky md:top-5">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium text-[#2e7d4f]">LINE 已入點</p><h2 className="mt-1 text-xl font-semibold">{item.customerName}</h2>{item.petName ? <p className="mt-1 text-sm text-zinc-500">毛孩：{item.petName}</p> : null}</div><CircleCheck className="h-7 w-7 text-[#2e7d4f]" /></div>
      <dl className="mt-5 divide-y divide-neutral-100 text-sm">
        <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">完成時間</dt><dd>{twDate.format(new Date(item.occurredAt))}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">商品</dt><dd className="text-right">{item.productName}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">序號</dt><dd>{item.codeMasked}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">本次點數</dt><dd className="font-semibold text-[#174733]">+{item.points} 點</dd></div>
      </dl>
      <p className="mt-4 rounded-xl bg-[#f2f7f4] px-4 py-3 text-xs leading-5 text-zinc-600">此紀錄由會員在匠寵官方 LINE 輸入 8 位序號後自動建立，店家不需要代為輸入。</p>
    </section>
  );
}

function RefillWorkspaceInner({ account, dashboard }: { account: PosAccount; dashboard: MerchantRefillDashboard }) {
  const [selectedId, setSelectedId] = useState(dashboard.transactions[0]?.id ?? null);
  const selected = dashboard.transactions.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-[#f7f8f7] text-zinc-900">
      <div className="md:flex md:min-h-screen">
        <InventorySideNav account={account} />
        <main className="min-w-0 flex-1 pb-24 md:pb-10">
          <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-5 md:px-8"><div><p className="text-sm text-zinc-500">店家服務</p><h1 className="mt-1 text-2xl font-semibold text-[#173f2b]">換罐計畫</h1></div><PosPageTools account={account} /></header>
          <div className="mx-auto max-w-[1280px] space-y-5 px-4 py-5 md:px-8 md:py-7">
            <section className="rounded-[24px] border border-[#cfe0d6] bg-[#f2f7f4] p-5 md:flex md:items-center md:justify-between md:gap-6"><div><p className="text-lg font-semibold text-[#174733]">會員自己在 LINE 完成序號登錄</p><p className="mt-2 text-sm leading-6 text-zinc-600">客人加入匠寵官方 LINE 後輸入 8 位數字；HQ 自動入點，本頁只顯示 {dashboard.storeName || "本店"} 的內容與交易紀錄。</p></div><span className="mt-4 inline-flex shrink-0 rounded-full bg-[#2e7d4f] px-4 py-2 text-sm font-medium text-white md:mt-0">LINE 已連線</span></section>
            {!dashboard.storeReady ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">本店尚未完成換罐計畫店家綁定，為避免顯示其他店家資料，交易紀錄已暫時隱藏。請聯絡匠寵客服完成設定。</section> : null}
            <section className="grid grid-cols-3 gap-3"><SummaryCard label="今日 LINE 入點" value={`${dashboard.summary.today} 筆`} /><SummaryCard label="本月交易" value={`${dashboard.summary.thisMonth} 筆`} /><SummaryCard label="本店可換庫存" value={`${dashboard.summary.availableStock} 份`} /></section>
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
              <div className="space-y-5">
                <section className="rounded-[24px] border border-neutral-200 bg-white p-5">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf3ed] text-[#2e7d4f]"><PackageOpen className="h-5 w-5" /></span><div><h2 className="font-semibold">本店換罐內容</h2><p className="text-xs text-zinc-500">{dashboard.plan.flavourUpdateNote}</p></div></div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">{dashboard.inventory.length ? dashboard.inventory.map((stock) => <div key={stock.id} className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3"><div><p className="font-medium">{stock.name}</p><p className="text-xs text-zinc-500">{stock.weightGrams}g</p></div><span className={stock.isAvailable && stock.quantity > 0 ? "text-sm font-semibold text-[#2e7d4f]" : "text-sm text-zinc-400"}>{stock.isAvailable && stock.quantity > 0 ? `${stock.quantity} 份` : "暫無庫存"}</span></div>) : <p className="text-sm text-zinc-500">目前尚未設定本店可換內容。</p>}</div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-neutral-100 pt-4 text-sm text-zinc-600"><span>每罐 +{dashboard.plan.pointsPerJar} 點</span><span>{dashboard.plan.pointsForDiscount} 點折 NT${dashboard.plan.discountAmount}</span><span>換罐價 NT${dashboard.plan.exchangePrice}</span></div>
                </section>
                <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
                  <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4"><History className="h-5 w-5 text-[#2e7d4f]" /><div><h2 className="font-semibold">本店 LINE 交易紀錄</h2><p className="text-xs text-zinc-500">最新 100 筆，只顯示本店會員交易</p></div></div>
                  {dashboard.transactions.length ? <ul className="divide-y divide-neutral-100">{dashboard.transactions.map((item) => <li key={item.id}><button type="button" onClick={() => setSelectedId(item.id)} className={`grid w-full grid-cols-[74px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 text-left transition ${selectedId === item.id ? "bg-[#f2f7f4]" : "hover:bg-neutral-50"}`}><span className="text-sm text-zinc-500">{twDate.format(new Date(item.occurredAt))}</span><span className="min-w-0"><strong className="block truncate font-medium">{item.customerName}</strong><span className="block truncate text-xs text-zinc-500">{item.productName} · {item.codeMasked}</span></span><span className="flex items-center gap-2 font-semibold text-[#2e7d4f]">+{item.points} 點<ChevronRight className="h-4 w-4" /></span></button></li>)}</ul> : <div className="px-5 py-12 text-center"><Box className="mx-auto h-8 w-8 text-zinc-300" /><p className="mt-3 text-sm text-zinc-500">本店目前還沒有 LINE 換罐交易。</p></div>}
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
