import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata = { title: '叫貨 · Furmosa 店家' };

export default async function PosRestockHubPage() {
  await requireMerchantSession();

  return (
    <PosShell>
      <div className="px-4 py-6">
        <h1 className="mb-1 text-xl font-semibold text-navy">叫貨</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          寄賣零食補貨。換罐口味請到「換罐」。
        </p>

        <Card className="shadow-card">
          <CardContent className="space-y-3 p-5">
            <p className="font-medium text-foreground">零食補貨請聯繫 Furmosa</p>
            <p className="text-sm text-muted-foreground">
              店家自己申請寄賣零食補貨還在整理。現在若缺貨，請直接聯絡總部。
            </p>
            <Button asChild className="min-h-[44px] w-full">
              <Link href="/pos/refill">去換罐計畫</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PosShell>
  );
}
