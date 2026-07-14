'use client';

import { Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { autoFillMerchantCommissionRules } from '@/app/(main)/merchants/[id]/actions';

export function AutoFillCommissionButton({ merchantId }: { merchantId: string }) {
  return (
    <form
      action={autoFillMerchantCommissionRules}
      onSubmit={(e) => {
        if (
          !confirm(
            '這會把本店所有商品的分潤比例，依商品名稱重新判斷一次（凍乾 30%、其餘 20%）。已手動調整過的規則也會被覆蓋，確定嗎？',
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="merchantId" value={merchantId} />
      <Button size="sm" variant="outline" type="submit">
        <Percent className="mr-1 h-3 w-3" />
        依品名自動填分潤
      </Button>
    </form>
  );
}
