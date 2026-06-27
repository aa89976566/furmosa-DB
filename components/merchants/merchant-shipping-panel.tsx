'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { merchantCarrierLabel } from '@/lib/merchant-shipping-defaults';
import { CARRIER_711 } from '@/lib/carrier-cvs';
import { Pencil, X } from 'lucide-react';
import {
  MerchantShippingForm,
  type MerchantShippingInput,
} from '@/components/merchants/merchant-shipping-form';

function shippingSummaryLine(merchant: MerchantShippingInput) {
  const parts: string[] = [];
  if (merchant.preferredCarrier === CARRIER_711 && merchant.pickupStoreName) {
    parts.push(merchant.pickupStoreName);
  } else if (merchant.address) {
    parts.push(merchant.address);
  }
  if (merchant.contactName) parts.push(merchant.contactName);
  if (merchant.phone) parts.push(merchant.phone);
  return parts.join(' · ') || '尚未設定收件資料';
}

export function MerchantShippingPanel({ merchant }: { merchant: MerchantShippingInput }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-navy">編輯運輸與地址</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            <X className="mr-1 h-3.5 w-3.5" />
            收起
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">進貨建立出貨單時會自動帶入。</p>
        <MerchantShippingForm
          merchant={merchant}
          compact
          onSaved={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground">運輸與地址</p>
        <p className="text-sm font-medium text-navy">
          {merchantCarrierLabel(merchant.preferredCarrier)}
        </p>
        <p className="truncate text-xs text-muted-foreground">{shippingSummaryLine(merchant)}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setEditing(true)}
      >
        <Pencil className="mr-1 h-3.5 w-3.5" />
        編輯
      </Button>
    </div>
  );
}
