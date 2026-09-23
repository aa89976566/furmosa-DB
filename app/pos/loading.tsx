export default function PosLoading() {
  return (
    <main
      className="min-h-screen bg-neutral-100 px-4 pb-24 pt-5 text-zinc-900 md:px-6 md:pb-8"
      aria-busy="true"
      aria-label="POS 頁面載入中"
    >
      <div className="mx-auto w-full max-w-5xl animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <div className="h-8 w-28 rounded-lg bg-neutral-300" />
            <div className="h-4 w-52 rounded bg-neutral-200" />
          </div>
          <div className="flex gap-2">
            <div className="h-11 w-11 rounded-full bg-neutral-200" />
            <div className="h-11 w-11 rounded-full bg-neutral-200" />
          </div>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          <div className="h-32 rounded-2xl bg-white" />
          <div className="h-32 rounded-2xl bg-white" />
          <div className="h-24 rounded-2xl bg-white md:col-span-2" />
        </div>
      </div>
      <span className="sr-only">載入中…</span>
    </main>
  );
}
