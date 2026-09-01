import { Check } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PosShell } from '@/components/pos/pos-shell';
import { RestockReceiptVerification } from '@/components/pos/restock-receipt-verification';
import { resolveFurmosaProductImage } from '@/lib/pos/furmosa-com-images';

export const metadata = { title: '補貨驗收 Preview · Furmosa' };
export const dynamic = 'force-dynamic';

export default function RestockReceiptPreviewPage() {
  if (process.env.VERCEL_ENV === 'production') notFound();

  const timeline = ['HQ 核准', '完成備貨', '商品出貨', '物流送達', '店家驗收'];

  return (
    <PosShell storeName="匠寵換罐測試店" wide>
      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 md:px-8 md:py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-navy md:text-3xl">補貨單</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            編號 CMTJ6QIY ・ 送出時間 2026/9/1 下午9:34:30
          </p>
        </header>

        <section className="rounded-2xl border bg-card p-5 md:p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <Check className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold md:text-xl">商品已送達，待驗收</h2>
              <p className="mt-1 text-sm text-muted-foreground">請逐項核對實收數量。</p>
              <p className="mt-4 text-sm text-muted-foreground">出貨單</p>
              <p className="font-medium">SHP-202609-0002</p>
            </div>
          </div>
          <ol className="mt-7 grid grid-cols-5 gap-1" aria-label="補貨處理進度">
            {timeline.map((label, index) => {
              const done = index < 4;
              return (
                <li key={label} className="relative text-center">
                  {index > 0 ? (
                    <span
                      className={`absolute right-1/2 top-4 h-px w-full ${done ? 'bg-foreground' : 'bg-border'}`}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full border ${
                      done
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-card'
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <span className="mt-2 block text-[11px] leading-tight md:text-sm">{label}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-2xl border bg-card px-5 py-4 md:px-6">
          <p className="text-sm text-muted-foreground">預計到貨</p>
          <p className="mt-1 font-medium">2026/9/15</p>
        </section>

        <RestockReceiptVerification
          requestId="preview"
          preview
          items={[
            {
              lineId: 'preview-line',
              productId: 'preview-product',
              name: '換罐－雞肉凍乾（測試）',
              sku: 'SKU-REFILL-TEST',
              specification: '100g',
              imageUrl: resolveFurmosaProductImage('雞肉凍乾', null),
              expectedQuantity: 1,
            },
          ]}
        />
      </main>
    </PosShell>
  );
}
