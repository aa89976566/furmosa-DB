import { PosShell } from '@/components/pos/pos-shell';

function CardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl bg-white p-3 shadow-sm">
      <div className="h-28 rounded-xl bg-neutral-100 sm:h-32" />
      <div className="mt-3 h-5 w-3/4 rounded bg-neutral-100" />
      <div className="mt-2 h-5 w-1/2 rounded bg-neutral-100" />
      <div className="mt-2 h-6 w-20 rounded-full bg-neutral-100" />
      <div className="mt-3 h-12 rounded-xl bg-neutral-100" />
    </div>
  );
}

export default function StockLoading() {
  return (
    <PosShell wide>
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-5 md:px-6" aria-busy="true" aria-live="polite">
        <p className="sr-only">正在載入庫存</p>
        <div className="h-8 w-16 rounded bg-neutral-200" />
        <div className="mt-2 h-5 w-64 max-w-full rounded bg-neutral-200" />
        <div className="mt-6 h-5 w-40 rounded bg-neutral-200" />
        <div className="mt-3 h-12 w-full rounded-full bg-white ring-1 ring-neutral-200" />
        <div className="mt-6 flex gap-2">
          <div className="h-11 w-16 rounded-full bg-neutral-200" />
          <div className="h-11 w-16 rounded-full bg-neutral-200" />
          <div className="h-11 w-16 rounded-full bg-neutral-200" />
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <li key={index}>
              <CardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    </PosShell>
  );
}
