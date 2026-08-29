'use client';

import { PosShell } from '@/components/pos/pos-shell';

export default function StockError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PosShell wide>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900">庫存</h1>
        <div className="mt-6 max-w-lg rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-lg font-semibold text-zinc-900">庫存暫時讀取失敗</p>
          <p className="mt-2 text-base text-zinc-600">
            現在看不到店裡的商品數量。沒有用 0 件代替，請重新載入後再查看。
          </p>
          <button
            type="button"
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white"
            onClick={() => reset()}
          >
            重新載入
          </button>
        </div>
      </div>
    </PosShell>
  );
}
