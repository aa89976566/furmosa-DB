import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: '叫貨 · Furmosa 店家' };

const ENTRIES = [
  {
    href: '/pos/restock/new?mode=SELF_SELECT',
    title: '我要自己選',
    hint: '選商品、填數量，送出申請',
  },
  {
    href: '/pos/restock/new?mode=AUTO_REPLENISH',
    title: '請幫我配',
    hint: '告訴公司需求，由公司幫你配',
  },
  {
    href: '/pos/restock/progress',
    title: '申請進度',
    hint: '看公司確認到哪、預計何時到貨',
  },
] as const;

export default async function PosRestockHubPage() {
  await requireMerchantSession();

  return (
    <PosShell>
      <div className="px-4 py-6">
        <h1 className="mb-1 text-xl font-semibold text-navy">叫貨</h1>
        <p className="mb-5 text-sm text-muted-foreground">補貨申請，不用再傳 LINE。</p>

        <div className="grid gap-3">
          {ENTRIES.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="shadow-card transition hover:border-primary/40">
                <CardContent className="flex min-h-[72px] flex-col justify-center gap-1 p-4">
                  <p className="text-base font-semibold text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.hint}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </PosShell>
  );
}
