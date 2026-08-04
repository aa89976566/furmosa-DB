import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { PosShell } from '@/components/pos/pos-shell';

export const metadata = { title: '叫貨 · Furmosa 店家' };

const ENTRIES = [
  {
    href: '/pos/restock/new?mode=SELF_SELECT',
    title: '我要自己選',
    hint: '選口味與數量',
  },
  {
    href: '/pos/restock/new?mode=AUTO_REPLENISH',
    title: '請幫我配',
    hint: '用一句話告訴公司',
  },
  {
    href: '/pos/restock/progress',
    title: '申請進度',
    hint: '確認狀態與到貨日',
  },
] as const;

export default async function PosRestockHubPage() {
  await requireMerchantSession();

  return (
    <PosShell>
      <div className="px-5 pb-4 pt-8">
        <header className="mb-8">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-sage">
            Furmosa
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">叫貨</h1>
          <p className="mt-1 text-sm text-muted-foreground">補貨申請，不用再傳 LINE</p>
        </header>

        <nav className="divide-y divide-border/70" aria-label="叫貨方式">
          {ENTRIES.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-[72px] items-center justify-between gap-3 py-4 first:pt-1"
            >
              <div>
                <p className="text-base font-semibold text-ink group-hover:text-primary">
                  {item.title}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.hint}</p>
              </div>
              <span className="text-muted-foreground group-hover:text-primary">→</span>
            </Link>
          ))}
        </nav>
      </div>
    </PosShell>
  );
}
