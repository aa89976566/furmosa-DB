import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { submitStocktake } from '../actions';
import { StocktakeFields } from '../stocktake-fields';

export const dynamic = 'force-dynamic';

export default async function StocktakePage(props: { params: Promise<{ productId: string }>; searchParams: Promise<{ error?: string; attempt?: string }> }) {
  const [{ productId }, query] = await Promise.all([props.params, props.searchParams]);
  if (!query.attempt) redirect(`/inventory/stocktake/${productId}?attempt=${randomUUID()}`);
  const [product, warehouse] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, include: { inventoryBalances: { include: { warehouse: true } } } }),
    prisma.warehouse.findUnique({ where: { code: 'WH-MAIN' } }),
  ]);
  if (!product || !warehouse) notFound();
  const balance = product.inventoryBalances.find((row) => row.warehouseId === warehouse.id);
  const beforeQuantity = balance?.quantity ?? 0;
  const beforeValue = beforeQuantity * Number(product.averageCostPerGram ?? 0);
  return <>
    <PageHeader title={`盤點調整・${product.name}`} description="以實際克數與總成本修正 HQ 主倉；系統會保留調整前後紀錄。" actions={<Button variant="outline" asChild><Link href="/inventory">返回庫存</Link></Button>} />
    <form action={submitStocktake} className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <input type="hidden" name="productId" value={product.id} /><input type="hidden" name="warehouseId" value={warehouse.id} /><input type="hidden" name="eventKey" value={query.attempt} />
      {query.error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{query.error}</p> : null}
      <Card className="grid gap-4 p-5 sm:grid-cols-2"><div><p className="text-sm text-muted-foreground">目前主倉庫存</p><p className="mt-1 text-2xl font-semibold">{beforeQuantity.toLocaleString()} {balance?.unit ?? '未確認單位'}</p></div><div><p className="text-sm text-muted-foreground">目前估計總成本</p><p className="mt-1 text-2xl font-semibold">NT${beforeValue.toFixed(2)}</p></div></Card>
      <StocktakeFields />
      <div className="sticky bottom-4 flex justify-end rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur"><Button size="lg" type="submit">確認盤點調整</Button></div>
    </form>
  </>;
}
