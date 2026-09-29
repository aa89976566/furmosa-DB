import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createPurchaseReceipt } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewPurchaseReceiptPage(props: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, vendors, warehouses, products] = await Promise.all([
    props.searchParams,
    prisma.vendor.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.warehouse.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], select: { id: true, name: true, code: true } }),
    prisma.product.findMany({ where: { status: { not: 'inactive' }, productCategory: 'STANDARD' }, orderBy: { name: 'asc' }, select: { id: true, name: true, sku: true } }),
  ]);
  return <>
    <PageHeader title="新增進貨" description="輸入實收重量與單據金額；確認後會一次完成入庫與移動平均成本更新" actions={<Button variant="outline" asChild><Link href="/inventory/purchases">返回進貨紀錄</Link></Button>} />
    <form action={createPurchaseReceipt} className="space-y-6 p-4 md:p-6" encType="multipart/form-data">
      {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">供應商<select name="vendorId" className="mt-2 h-10 w-full rounded-md border bg-background px-3"><option value="">未指定</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium">入庫倉庫<select name="warehouseId" required className="mt-2 h-10 w-full rounded-md border bg-background px-3">{warehouses.map(w => <option key={w.id} value={w.id}>{w.name} · {w.code}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium">進貨日期<Input className="mt-2" type="date" name="receiptDate" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        <label className="space-y-2 text-sm font-medium">供應商單號<Input className="mt-2" name="supplierDocumentNumber" placeholder="報價單／Invoice 編號" /></label>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b p-5"><h2 className="text-lg font-semibold">本次實收商品</h2><p className="mt-1 text-sm text-muted-foreground">每個商品只填一列；重量一律填實際收到的克數。</p></div>
        <div className="divide-y">{Array.from({ length: 8 }, (_, index) => <div key={index} className="grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_150px_160px_190px]">
          <label className="text-sm">商品<select name="productId" className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="">選擇商品</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label>
          <label className="text-sm">實收重量（g）<Input className="mt-1" name="quantityGrams" type="number" min="1" step="1" inputMode="numeric" /></label>
          <label className="text-sm">商品金額（NT$）<Input className="mt-1" name="rawAmount" type="number" min="0" step="0.01" inputMode="decimal" /></label>
          <label className="text-sm">舊庫存成本/g（首次）<Input className="mt-1" name="openingAverageCostPerGram" type="number" min="0" step="0.000001" inputMode="decimal" placeholder="沒有舊庫存可留白" /></label>
        </div>)}</div>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
        {([['shippingCost','運費'],['packagingCost','包材費'],['processingCost','加工費'],['taxAmount','稅額'],['discountAmount','折扣']] as const).map(([name,label]) => <label key={name} className="text-sm font-medium">{label}（NT$）<Input className="mt-2" name={name} type="number" min="0" step="0.01" defaultValue="0" required /></label>)}
        <p className="sm:col-span-2 lg:col-span-5 text-sm text-muted-foreground">共同費用與折扣會依各商品原料金額比例分攤，尾差精確分配到分。</p>
      </Card>

      <Card className="space-y-4 p-5">
        <label className="block text-sm font-medium">單據照片／PDF（最多 3 個，每個 5MB）<Input className="mt-2" name="attachments" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple /></label>
        <label className="block text-sm font-medium">備註<textarea name="note" rows={3} className="mt-2 w-full rounded-md border bg-background px-3 py-2" /></label>
      </Card>
      <div className="sticky bottom-4 flex justify-end"><Button size="lg" type="submit">確認進貨並入庫</Button></div>
    </form>
  </>;
}
