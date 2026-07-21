import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { posLogoutAction } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: '店家首頁 · Furmosa',
};

const PLACEHOLDERS = [
  { title: '今日預約', hint: '即將開放' },
  { title: '待確認', hint: '即將開放' },
  { title: '待交付換罐', hint: '即將開放' },
  { title: '庫存提醒', hint: '即將開放' },
  { title: '一鍵叫貨', hint: '即將開放' },
] as const;

export default async function PosHomePage() {
  const session = await requireMerchantSession();
  const merchant = await prisma.merchant.findFirst({
    where: { id: session.merchantId },
    select: { id: true, name: true, merchantId: true },
  });

  // Extra isolation: never show another merchant even if session were tampered in DB layer tests
  if (!merchant || merchant.id !== session.merchantId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-destructive">找不到店家資料，請重新登入。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Furmosa 店家</p>
          <h1 className="text-xl font-semibold text-navy">{merchant.name}</h1>
          <p className="text-xs text-muted-foreground">登入帳號：{session.username}</p>
        </div>
        <form action={posLogoutAction}>
          <Button type="submit" variant="outline" className="min-h-[44px]">
            登出
          </Button>
        </form>
      </header>

      <div className="grid gap-3">
        {PLACEHOLDERS.map((item) => (
          <Card key={item.title} className="shadow-card">
            <CardContent className="flex min-h-[72px] items-center justify-between p-4">
              <div>
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.hint}</p>
              </div>
              <span className="text-lg font-semibold text-muted-foreground">—</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        目前僅開放店家登入。預約、換罐與叫貨功能即將開放。
      </p>
    </div>
  );
}
