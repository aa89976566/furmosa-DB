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

export function CodesAdminTools() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastBatchNo, setLastBatchNo] = useState<string | null>(null);
  const [printBatch, setPrintBatch] = useState('');

  const afterSuccess = (text: string) => {
    setError(null);
    setMsg(text);
    router.refresh();
  };

  const activeBatch = printBatch.trim() || lastBatchNo;

  return (
    <div className="space-y-4 border-b border-border/60 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            setError(null);
            startTransition(async () => {
              try {
                const res = await generateJarCodesBatch(DEFAULT_BATCH_SIZE);
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
            <Button
              type="button"
              variant="outline"
              onClick={() => triggerPdfDownload(activeBatch, DEFAULT_BATCH_SIZE)}
            >
              下載 A4 PDF
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link
                href={`/jar-exchange/codes?batch=${encodeURIComponent(activeBatch)}&status=unused`}
                target="_blank"
                rel="noopener noreferrer"
              >
                預覽列印頁
              </Link>
            </Button>
          </>
        ) : null}

        {msg ? <span className="text-sm text-success">{msg}</span> : null}
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">依批次匯出 PDF</p>
          <Input
            value={printBatch}
            onChange={(e) => setPrintBatch(e.target.value)}
            placeholder="BATCH-20260524"
            className="h-8 w-48 font-mono text-xs"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!printBatch.trim()}
          onClick={() => {
            if (printBatch.trim()) triggerPdfDownload(printBatch.trim());
          }}
        >
          下載 PDF
        </Button>
        <Button type="button" size="sm" variant="outline" asChild disabled={!printBatch.trim()}>
          <Link
            href={
              printBatch.trim()
                ? `/jar-exchange/codes?batch=${encodeURIComponent(printBatch.trim())}&status=unused`
                : '#'
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            預覽列印頁
          </Link>
        </Button>
        <p className="w-full text-[11px] text-muted-foreground">
          序號僅限 {JAR_CODE_LENGTH} 位純數字。每張 A4 固定 {DEFAULT_BATCH_SIZE} 格（5×14）。
          PDF 預設只匯出該批次最早 {DEFAULT_BATCH_SIZE} 筆；若舊批次有 90 筆是因先前多寫入，請用新批次或刪除多餘序號。
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
              startTransition(async () => {
                const res = await createManualJarCode(new FormData(e.currentTarget));
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
            <Input name="productSku" placeholder="產品 SKU（選填）" />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
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
            <p className="text-xs text-muted-foreground">每行一組數字序號</p>
            <textarea
              name="codes"
              rows={4}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-sm"
              placeholder="12345678"
            />
            <Input name="batchNo" placeholder="批次編號" />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              匯入
            </Button>
          </form>
        </div>
      </details>
    </div>
  );
}
