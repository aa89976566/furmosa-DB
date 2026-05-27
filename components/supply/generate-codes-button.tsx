'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateJarCodesBatch } from '@/app/(main)/jar-exchange/actions';
import { DEFAULT_BATCH_SIZE } from '@/lib/jar-exchange/print-labels';

export function GenerateCodesButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {message ? <span className="text-xs text-neutral-500">{message}</span> : null}
      <Button
        type="button"
        disabled={pending}
        className="rounded-full bg-neutral-900 px-5 text-white hover:bg-neutral-800"
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              const res = await generateJarCodesBatch(DEFAULT_BATCH_SIZE);
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
    </div>
  );
}
