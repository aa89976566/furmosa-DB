import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createPendingPurchaseOrder } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewPurchaseOrderPage(props: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, vendors, warehouses, products] = await Promise.all([
    props.searchParams,
    prisma.vendor.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.warehouse.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], select: { id: true, name: true, code: true } }),
    prisma.product.findMany({ where: { status: { not: 'inactive' }, productCategory: 'STANDARD' }, orderBy: { name: 'asc' }, select: { id: true, name: true, sku: true } }),
  ]);
  return <>
    <PageHeader title="新增採購單" description="先保存供應商訂單，不會增加庫存；到貨後需另行確認實收。" actions={<Button variant="outline" asChild><Link href="/inventory/purchases?view=pending">返回待收貨</Link></Button>} />
    <form action={createPendingPurchaseOrder} className="mx-auto max-w-6xl space-y-6 p-4 md:p-6" encType="multipart/form-data">
      {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <label className="text-sm font-medium">供應商<select name="vendorId" className="mt-2 h-10 w-full rounded-md border bg-background px-3"><option value="">未指定</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label className="text-sm font-medium">預計入庫倉庫<select name="warehouseId" required className="mt-2 h-10 w-full rounded-md border bg-background px-3">{warehouses.map(w => <option key={w.id} value={w.id}>{w.name} · {w.code}</option>)}</select></label>
        <label className="text-sm font-medium">供應商單號<Input className="mt-2" name="supplierDocumentNumber" placeholder="報價單／Invoice 編號" /></label>
        <label className="text-sm font-medium">開始提醒日<Input className="mt-2" type="date" name="remindFromDate" required defaultValue="2026-11-01" /></label>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b p-5"><h2 className="text-lg font-semibold">預計到貨商品</h2><p className="mt-1 text-sm text-muted-foreground">這裡只記錄訂購內容；確認實收前不會更新庫存。</p></div>
        <div className="divide-y">{Array.from({ length: 8 }, (_, index) => <div key={index} className="grid gap-3 p-4 md:grid-cols-[minmax(240px,1fr)_180px_180px]">
          <label className="text-sm">商品<select name="productId" className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="">選擇商品</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label>
          <label className="text-sm">訂購重量（g）<Input className="mt-1" name="quantityGrams" type="number" min="1" step="1" /></label>
          <label className="text-sm">商品金額（NT$）<Input className="mt-1" name="rawAmount" type="number" min="0.01" step="0.01" /></label>
        </div>)}</div>
      </Card>
      <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
        {([['shippingCost','運費'],['packagingCost','包材費'],['processingCost','加工費'],['taxAmount','稅額'],['discountAmount','折扣']] as const).map(([name,label]) => <label key={name} className="text-sm font-medium">{label}（NT$）<Input className="mt-2" name={name} type="number" min="0" step="0.01" defaultValue="0" required /></label>)}
      </Card>
      <Card className="space-y-4 p-5"><label className="block text-sm font-medium">單據照片／PDF（最多 3 個，每個 5MB）<Input className="mt-2" name="attachments" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple /></label><label className="block text-sm font-medium">備註<textarea name="note" rows={3} className="mt-2 w-full rounded-md border bg-background px-3 py-2" /></label></Card>
      <div className="sticky bottom-4 rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur sm:flex sm:items-center sm:justify-between"><p className="mb-3 text-sm font-medium text-warning sm:mb-0">建立採購單不會更新庫存。</p><Button size="lg" type="submit">建立採購單</Button></div>
    </form>
  </>;
}
