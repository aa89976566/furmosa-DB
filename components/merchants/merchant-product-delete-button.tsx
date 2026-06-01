'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { removeMerchantProduct } from '@/app/(main)/merchants/[id]/actions';

export function MerchantProductDeleteButton({
  merchantId,
  productId,
  productName,
  quantity,
  redirectTo,
  label,
}: {
  merchantId: string;
  productId: string;
  productName: string;
  quantity: number;
  redirectTo?: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={() => {
        const warn =
          quantity > 0
            ? `「${productName}」此店尚有 ${quantity} 件庫存。確定要從寄賣中移除嗎？（庫存與分潤規則會一併刪除，歷史流水保留）`
            : `確定要從寄賣中移除「${productName}」嗎？（分潤規則會一併刪除，歷史流水保留）`;
        if (!confirm(warn)) return;
        const fd = new FormData();
        fd.set('merchantId', merchantId);
        fd.set('productId', productId);
        if (redirectTo) fd.set('redirectTo', redirectTo);
        startTransition(() => {
          void removeMerchantProduct(fd);
        });
      }}
    >
      <Trash2 className="mr-1 h-3.5 w-3.5" />
      {label ?? '刪除'}
    </Button>
  );
}
