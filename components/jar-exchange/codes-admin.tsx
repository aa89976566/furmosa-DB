'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JAR_CODE_LENGTH } from '@/lib/jar-exchange/codes';
import { jarCodesPdfDownloadUrl } from '@/lib/jar-exchange/build-labels-pdf';
import { DEFAULT_BATCH_SIZE } from '@/lib/jar-exchange/print-labels';
import {
  createManualJarCode,
  generateJarCodesBatch,
  importJarCodes,
} from '@/app/(main)/jar-exchange/actions';

export type JarProductOption = { id: string; name: string; sku: string };

function triggerPdfDownload(batch: string, limit = DEFAULT_BATCH_SIZE) {
  const url = jarCodesPdfDownloadUrl(batch, 'unused', { limit });
  const a = document.createElement('a');
  a.href = url;
  a.download = `jar-codes-${batch}.pdf`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function CodesAdminTools({ products }: { products: JarProductOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastBatchNo, setLastBatchNo] = useState<string | null>(null);
  const [printBatch, setPrintBatch] = useState('');
  const [productId, setProductId] = useState(products[0]?.id ?? '');

  const afterSuccess = (text: string) => {
    setError(null);
    setMsg(text);
    router.refresh();
  };

  const activeBatch = printBatch.trim() || lastBatchNo;

  return (
    <div className="space-y-4 border-b border-border/60 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs text-muted-foreground">
          綁定換罐商品
          <select
            className="mt-1 block min-w-[16rem] rounded-xl border border-input bg-card px-3 py-2 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={products.length === 0}
          >
            {products.length === 0 ? (
              <option value="">尚無 JAR_EXCHANGE 商品</option>
            ) : (
              products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.sku}）
                </option>
              ))
            )}
          </select>
        </label>
        <Button
          type="button"
          disabled={pending || !productId}
          onClick={() => {
            setMsg(null);
            setError(null);
            startTransition(async () => {
              try {
                const res = await generateJarCodesBatch(
                  DEFAULT_BATCH_SIZE,
                  undefined,
                  productId,
                );
                if (res.ok) {
                  setLastBatchNo(res.batchNo);
                  setPrintBatch(res.batchNo);
                  afterSuccess(
                    `已生成 ${res.count} 組序號（批次 ${res.batchNo}），正在下載 PDF…`,
                  );
                  triggerPdfDownload(res.batchNo);
                } else {
                  setError(res.error);
                  setMsg(null);
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : '生成失敗');
                setMsg(null);
              }
            });
          }}
        >
          {pending
            ? '生成中…'
            : `＋ 生成 ${DEFAULT_BATCH_SIZE} 組並匯出 PDF`}
        </Button>

        {activeBatch ? (
          <>
            <Input
              value={printBatch || lastBatchNo || ''}
              onChange={(e) => setPrintBatch(e.target.value)}
              placeholder="批次編號"
              className="w-48"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
            >
              <a href={jarCodesPdfDownloadUrl(activeBatch, 'unused', { limit: DEFAULT_BATCH_SIZE })}>
                下載 PDF
              </a>
            </Button>
          </>
        ) : null}
      </div>

      {products.length === 0 ? (
        <p className="text-xs text-destructive">
          請先在產品將換罐 SKU 的類型設為「換罐」（JAR_EXCHANGE），才能產生序號。{' '}
          <Link href="/products" className="underline">
            前往產品
          </Link>
        </p>
      ) : null}

      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div>
        <p className="text-[11px] text-muted-foreground">
          PDF 預設只匯出該批次最早 {DEFAULT_BATCH_SIZE} 筆；序號必須綁定換罐商品。
        </p>
      </div>

      <details className="rounded-xl border border-border/60 p-3">
        <summary className="cursor-pointer text-sm font-medium">手動新增 / 匯入序號</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const fd = new FormData(e.currentTarget);
              if (productId) fd.set('productId', productId);
              startTransition(async () => {
                const res = await createManualJarCode(fd);
                if (res.ok) afterSuccess('已新增序號');
                else {
                  setError(res.error ?? '失敗');
                  setMsg(null);
                }
              });
            }}
          >
            <p className="text-xs text-muted-foreground">單筆新增（{JAR_CODE_LENGTH} 位數字）</p>
            <Input
              name="code"
              placeholder="12345678"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={JAR_CODE_LENGTH}
              required
            />
            <Input name="batchNo" placeholder="批次編號（選填）" />
            <input type="hidden" name="productId" value={productId} />
            <Button type="submit" size="sm" variant="outline" disabled={pending || !productId}>
              新增
            </Button>
          </form>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const fd = new FormData(e.currentTarget);
                if (productId) fd.set('productId', productId);
                const res = await importJarCodes(fd);
                if (res.ok) {
                  const b = String(fd.get('batchNo') ?? '').trim();
                  if (b) setPrintBatch(b);
                  afterSuccess(`匯入 ${res.created} 筆，略過 ${res.skipped} 筆`);
                } else {
                  setError(res.error ?? '失敗');
                  setMsg(null);
                }
              });
            }}
          >
            <p className="text-xs text-muted-foreground">每行一組數字序號（套用上方選的商品）</p>
            <textarea
              name="codes"
              rows={4}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-sm"
              placeholder="12345678"
            />
            <Input name="batchNo" placeholder="批次編號" />
            <input type="hidden" name="productId" value={productId} />
            <Button type="submit" size="sm" variant="outline" disabled={pending || !productId}>
              匯入
            </Button>
          </form>
        </div>
      </details>
    </div>
  );
}
