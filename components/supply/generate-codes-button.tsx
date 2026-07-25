'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateJarCodesBatch } from '@/app/(main)/jar-exchange/actions';
import { DEFAULT_BATCH_SIZE } from '@/lib/jar-exchange/print-labels';

/** 精簡按鈕：請改至 /jar-exchange/manage?tab=codes 選商品後生成 */
export function GenerateCodesButton({ productId }: { productId?: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {message ? <span className="text-xs text-neutral-500">{message}</span> : null}
      {productId ? (
        <Button
          type="button"
          disabled={pending}
          className="rounded-full bg-neutral-900 px-5 text-white hover:bg-neutral-800"
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              try {
                const res = await generateJarCodesBatch(DEFAULT_BATCH_SIZE, undefined, productId);
                if (!res.ok) {
                  setMessage(res.error);
                  return;
                }
                setMessage(`已生成 ${res.count} 組 8 位數字序號（${res.batchNo}）`);
              } catch (e) {
                setMessage(e instanceof Error ? e.message : '生成失敗');
              }
            });
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {pending ? '生成中…' : `生成 ${DEFAULT_BATCH_SIZE} 組序號`}
        </Button>
      ) : (
        <Button type="button" variant="outline" asChild>
          <Link href="/jar-exchange/manage?tab=codes">
            至序號管理選商品後生成
          </Link>
        </Button>
      )}
    </div>
  );
}
