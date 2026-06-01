'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteCustomer } from '@/app/(main)/customers/actions';

export function CustomerDeleteButton({
  id,
  name,
  orderCount,
  subscriptionCount,
}: {
  id: string;
  name: string;
  orderCount: number;
  subscriptionCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const blocked = orderCount > 0 || subscriptionCount > 0;
  const blockReason =
    orderCount > 0
      ? `此客戶有 ${orderCount} 筆訂單紀錄，無法刪除`
      : subscriptionCount > 0
        ? `此客戶有 ${subscriptionCount} 筆訂閱合約，請先結束訂閱再刪除`
        : null;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || blocked}
        title={blockReason ?? undefined}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive disabled:text-muted-foreground"
        onClick={() => {
          if (
            !confirm(
              `確定要刪除客戶「${name}」嗎？\n換罐點數、獎勵兌換等資料會一併清除，已返航序號將退回未使用。此動作無法復原。`,
            )
          )
            return;
          setError(null);
          const fd = new FormData();
          fd.set('id', id);
          startTransition(async () => {
            const res = await deleteCustomer(fd);
            if (res && !res.ok) setError(res.error);
          });
        }}
      >
        <Trash2 className="mr-1 h-4 w-4" />
        {pending ? '刪除中…' : '刪除'}
      </Button>
      {(error ?? blockReason) ? (
        <span className="max-w-[220px] text-right text-[10px] text-destructive">
          {error ?? blockReason}
        </span>
      ) : null}
    </div>
  );
}
