import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: '補貨 · Furmosa 店家' };

const ENTRIES = [
  {
    href: '/pos/restock/new?mode=SELF_SELECT',
    title: '自己選商品',
    hint: '選擇商品與數量後送出',
  },
  {
    href: '/pos/restock/new?mode=AUTO_REPLENISH',
    title: '請公司建議數量',
    hint: '填寫需求，由公司確認商品與數量',
  },
  {
    href: '/pos/restock/progress',
    title: '追蹤補貨單',
    hint: '確認處理狀態與預計到貨日',
  },
] as const;

export default async function PosRestockHubPage() {
  await requireMerchantSession();

  return (
    <PosShell>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <header className="mb-6 border-b border-[#e7e5e4] pb-5">
          <p className="text-sm text-muted-foreground">門市工作</p>
          <h1 className="mt-1 text-2xl font-semibold">補貨</h1>
          <p className="mt-1 text-sm text-muted-foreground">建立補貨申請，並追蹤公司的確認與到貨進度。</p>
        </header>

        <div className="grid gap-3">
          {ENTRIES.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="border-[#e7e5e4] bg-white shadow-none transition hover:border-[#8a8a8a]">
                <CardContent className="flex min-h-[80px] items-center justify-between gap-3 p-4">
                  <div><p className="text-base font-semibold text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.hint}</p></div>
                  <span className="text-lg font-medium" aria-hidden="true">›</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </PosShell>
  );
}
