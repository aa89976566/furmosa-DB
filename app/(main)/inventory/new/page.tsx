import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { COUNT_ROLES } from '@/lib/inventory/workbench';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export default async function NewInventoryPurchasePage() {
  const user = await getCurrentUser();
  if (!user || !COUNT_ROLES.includes(user.role)) redirect('/inventory');
  return <>
    <PageHeader title="新增進貨" description="先確認商品是否到貨，再接續原有進貨流程。" actions={<Button asChild variant="outline"><Link href="/inventory">返回庫存</Link></Button>} />
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <section className="rounded-xl border bg-muted/30 p-5">
        <h2 className="text-base font-semibold">已經有進貨單？</h2>
        <p className="mt-2 text-sm text-muted-foreground">請從原單確認收貨，商品與金額會自動帶入，避免重複入庫。</p>
        <Button asChild variant="outline" className="mt-4 min-h-11"><Link href="/inventory/purchases?view=pending">從待收貨單收貨</Link></Button>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">尚未到貨</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">先記錄訂購商品、數量與金額。保存後列入待收貨，不會增加庫存。</p>
          <Button asChild className="mt-6 min-h-11"><Link href="/inventory/purchase-orders/new">建立待收貨進貨單</Link></Button>
        </section>
        <section className="flex flex-col rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">已收到貨，沒有進貨單</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">填寫本次實收數量及單據金額，確認後直接增加入庫倉庫的庫存。</p>
          <Button asChild variant="outline" className="mt-6 min-h-11"><Link href="/inventory/purchases/new">登記實收並入庫</Link></Button>
        </section>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">目前進貨表單僅支援克數與已知成本。以片、隻或包管理的商品，請先由管理員核對，勿換成克數填入。</p>
    </div>
  </>;
}
