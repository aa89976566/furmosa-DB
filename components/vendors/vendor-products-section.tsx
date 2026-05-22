'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { productCategoryLabel } from '@/lib/labels';
import {
  createVendorProduct,
  linkProductToVendor,
  unlinkProductFromVendor,
} from '@/app/(main)/vendors/actions';
import { Link2, Plus, Unlink } from 'lucide-react';

export type VendorProductRow = {
  id: string;
  productId: string;
  name: string;
  category: string;
  price: number;
  cost: number;
};

type LinkableProduct = {
  id: string;
  productId: string;
  name: string;
  vendorName: string | null;
};

export function VendorProductsSection({
  vendorId,
  products,
  linkableProducts,
}: {
  vendorId: string;
  products: VendorProductRow[];
  linkableProducts: LinkableProduct[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [linkProductId, setLinkProductId] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const [showAllLinkable, setShowAllLinkable] = useState(false);

  const filteredLinkable = linkableProducts.filter((p) => {
    if (!showAllLinkable && p.vendorName) return false;
    if (!linkSearch.trim()) return true;
    const term = linkSearch.trim().toLowerCase();
    return (
      p.productId.toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term) ||
      (p.vendorName?.toLowerCase().includes(term) ?? false)
    );
  });

  const runAction = async (fn: () => Promise<void>) => {
    try {
      await fn();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失敗');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant={showCreate ? 'secondary' : 'outline'}
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus className="mr-1 h-4 w-4" />
          {showCreate ? '取消新增' : '新增商品'}
        </Button>
        <Button size="sm" asChild variant="outline">
          <Link href={`/products/new?vendorId=${vendorId}`}>完整商品表單</Link>
        </Button>
      </div>

      {showCreate && (
        <form
          action={async (formData) => {
            await runAction(async () => {
              await createVendorProduct(formData);
              setShowCreate(false);
            });
          }}
          className="rounded-lg border bg-muted/20 p-4"
        >
          <input type="hidden" name="vendorId" value={vendorId} />
          <p className="mb-3 text-xs text-muted-foreground">
            建立後會同步出現在「產品」列表，並自動綁定此廠商
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              商品名稱 <span className="text-destructive">*</span>
              <Input name="name" required maxLength={120} placeholder="例：鴨肉蘋果" />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              分類
              <select
                name="category"
                defaultValue="treats"
                className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
              >
                {Object.entries(productCategoryLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              計價單位
              <Input name="unit" defaultValue="g" maxLength={20} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              參考售價
              <Input name="price" type="number" min={0} step="0.01" defaultValue={0} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              參考成本
              <Input name="cost" type="number" min={0} step="0.01" defaultValue={0} />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <SubmitButton label="建立並綁定" />
          </div>
        </form>
      )}

      {linkableProducts.length > 0 && (
        <form
          action={async (formData) => {
            await runAction(async () => {
              await linkProductToVendor(formData);
              setLinkProductId('');
              setLinkSearch('');
            });
          }}
          className="space-y-2 rounded-lg border border-dashed p-3"
        >
          <input type="hidden" name="vendorId" value={vendorId} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              連結既有商品（資料庫內所有 Product 主檔）
            </label>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={showAllLinkable}
                onChange={(e) => setShowAllLinkable(e.target.checked)}
                className="h-3.5 w-3.5 rounded border"
              />
              含其他廠商已綁定
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1">
              <Input
                type="search"
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                placeholder="搜尋編號或名稱…"
                className="h-9"
              />
            </div>
            <div className="min-w-[200px] flex-[2]">
              <select
                name="productId"
                required
                value={linkProductId}
                onChange={(e) => setLinkProductId(e.target.value)}
                className="flex h-9 w-full rounded-xl border border-input bg-card px-3 text-sm"
              >
                <option value="">
                  {filteredLinkable.length === 0
                    ? '無符合商品'
                    : `請選擇（${filteredLinkable.length} 筆）…`}
                </option>
                {filteredLinkable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.productId} · {p.name}
                    {p.vendorName ? `（目前：${p.vendorName}）` : '（未指定廠商）'}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" disabled={!linkProductId}>
              <Link2 className="mr-1 h-4 w-4" />
              連結
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            連結後會出現在本頁「廠商商品」與側欄「產品」列表（同一筆 Product 主檔）
          </p>
        </form>
      )}

      {products.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          尚未綁定任何商品 — 請用上方「新增商品」或「連結既有商品」
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>商品編號</TableHead>
              <TableHead>名稱</TableHead>
              <TableHead>分類</TableHead>
              <TableHead className="text-right">售價</TableHead>
              <TableHead className="text-right">成本</TableHead>
              <TableHead className="w-[100px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.productId}</TableCell>
                <TableCell>
                  <Link href={`/products/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>{productCategoryLabel[p.category]}</TableCell>
                <TableCell className="text-right">{formatCurrency(p.price)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(p.cost)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (!confirm(`解除「${p.name}」與此廠商的綁定？商品仍保留在產品列表。`))
                        return;
                      const fd = new FormData();
                      fd.set('productId', p.id);
                      fd.set('vendorId', vendorId);
                      runAction(() => unlinkProductFromVendor(fd));
                    }}
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? '處理中…' : label}
    </Button>
  );
}
