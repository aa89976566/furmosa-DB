import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { refreshInventoryViews } from '@/lib/inventory/refresh-views';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { COUNT_ROLES, inventoryUnit, parseCountQuantity } from '@/lib/inventory/workbench';
import { confirmInventoryUnit, UnitConfirmationError } from '@/lib/inventory/confirm-unit';
import { PageHeader } from '@/components/shared/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export default async function ConfirmUnitPage(props: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !COUNT_ROLES.includes(user.role)) redirect('/inventory');
  const [{ productId }, query] = await Promise.all([props.params, props.searchParams]);
  const product = await prisma.product.findUnique({ where: { id: productId },
    include: { inventoryBalances: { include: { warehouse: true } } } });
  if (!product) notFound();
  const unit = inventoryUnit(product.unit);
  const balance = product.inventoryBalances.find(b => b.warehouse.code === 'WH-MAIN');
  const available = !!unit && product.status === 'active' && product.productCategory === 'STANDARD'
    && (!balance || inventoryUnit(balance.unit) !== unit)
    && !product.inventoryBalances.some(b => b.warehouse.code !== 'WH-MAIN' && b.quantity !== 0);
  const eventKey = randomUUID();
  const version = balance?.updatedAt.toISOString() ?? null;
  const productVersion = product.updatedAt.toISOString();
  async function submit(form: FormData) {
    'use server';
    const actor = await getCurrentUser();
    if (!actor || !COUNT_ROLES.includes(actor.role)) redirect('/inventory');
    let error = '';
    try {
      if (form.get('confirmed') !== 'on') throw new UnitConfirmationError('請確認已核對實物與商品主檔單位');
      let quantity: number;
      try { quantity = parseCountQuantity(form.get('quantity')); }
      catch { throw new UnitConfirmationError('請輸入 0 以上的整數數量'); }
      await confirmInventoryUnit(prisma, { actorId: actor.userId, productId, eventKey,
        quantity, unit: unit ?? '', expectedVersion: version, expectedProductVersion: productVersion,
        reason: String(form.get('reason') ?? '') });
    } catch (cause) {
      error = cause instanceof UnitConfirmationError ? cause.message : '核對未完成，請重新整理確認庫存後再試';
    }
    if (error) redirect(`/inventory/confirm-unit/${encodeURIComponent(productId)}?error=${encodeURIComponent(error)}`);
    await refreshInventoryViews([productId]);
    redirect('/inventory');
  }
  return <>
    <PageHeader title={`核對庫存單位・${product.name}`} description="依實物重新確認 HQ 主倉數量" actions={<Button asChild variant="outline"><Link href="/inventory">返回庫存</Link></Button>} />
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      {query.error ? <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{query.error}</p> : null}
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <p className="font-medium">{product.name} · {product.sku}</p>
        <p>原主倉記錄：{balance ? `${balance.quantity} ${balance.unit ?? '單位未確認'}` : '尚無主倉記錄'}</p>
        <p>商品主檔單位：<strong>{unit ?? '尚未確認'}</strong></p>
        <p className="text-sm text-muted-foreground">請依實物重新清點。系統會結清舊單位記錄、建立新單位盤點及保留稽核紀錄，不會將克數自動換算為包數。廠商、進貨日期與成本不在此填寫。</p>
      </section>
      {available ? <form action={submit} className="space-y-5 rounded-xl border bg-card p-5">
        <label className="block text-sm font-medium">實際剩餘數量（{unit}）<Input name="quantity" aria-label={`實際剩餘數量（${unit}）`} type="text" inputMode="numeric" pattern="[0-9]+" required className="mt-2 min-h-11" /></label>
        <label className="block text-sm font-medium">核對來源與原因<Input name="reason" aria-label="核對來源與原因" required maxLength={300} placeholder="例如：Google Sheet 匠寵食品庫存，第 12 列，5 隻" className="mt-2 min-h-11" /></label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" required className="mt-1 h-4 w-4" />已核對實物與商品主檔，以上數量以「{unit}」為單位</label>
        <Button type="submit" className="min-h-11">確認單位並保存實際數量</Button>
      </form> : <p role="status" className="rounded-xl border p-5 text-sm">此商品單位已一致、商品未啟用、主檔單位未確認，或其他倉庫仍有庫存。請先核對商品設定；單位一致時使用一般盤點。</p>}
    </div>
  </>;
}
