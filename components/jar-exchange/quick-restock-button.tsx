'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { quickRestockJarMerchantAction } from '@/app/(main)/jar-exchange/ops/actions';
import { PackagePlus } from 'lucide-react';

type Props = {
  merchantId: string;
  productId?: string;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline' | 'secondary';
};

export function QuickRestockButton({
  merchantId,
  productId,
  label,
  disabled,
  size = 'sm',
  variant = 'default',
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [shipmentHref, setShipmentHref] = useState<string | null>(null);

  function onClick() {
    setMsg(null);
    setShipmentHref(null);
    startTransition(async () => {
      const res = await quickRestockJarMerchantAction({ merchantId, productId });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      const qty = res.items.reduce((s, it) => s + it.quantity, 0);
      setMsg(
        res.duplicated
          ? `已有相同待出貨單（${res.shipmentNumber}）`
          : `已建立補貨 ${qty} 件 → ${res.shipmentNumber}`,
      );
      setShipmentHref(`/shipments?s=${res.shipmentId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={disabled || pending}
        onClick={onClick}
      >
        <PackagePlus className="mr-1 h-3.5 w-3.5" />
        {pending ? '建立中…' : label}
      </Button>
      {msg ? (
        <p className="max-w-[14rem] text-[11px] leading-snug text-muted-foreground">
          {msg}
          {shipmentHref ? (
            <>
              {' · '}
              <Link href={shipmentHref} className="text-primary underline-offset-2 hover:underline">
                看出貨
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
