import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  PackagePlus,
  ScanLine,
  ShoppingCart,
  Receipt,
  ClipboardList,
  Boxes,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const actions: { href: (id: string) => string; label: string; icon: LucideIcon }[] = [
  { href: (id) => `/merchants/${id}/restock`, label: '進貨入庫', icon: PackagePlus },
  { href: (id) => `/merchants/${id}/adjust?mode=sold`, label: '登記賣出', icon: ScanLine },
  { href: (id) => `/merchants/${id}/adjust?mode=count`, label: '盤點剩餘', icon: Boxes },
  { href: (id) => `/merchants/${id}/sale`, label: '建立訂單', icon: ShoppingCart },
  { href: (id) => `/merchants/${id}/rule`, label: '分潤規則', icon: BookOpen },
  { href: (id) => `/merchants/${id}/shipments`, label: '運送狀態', icon: Truck },
  { href: (id) => `/merchants/${id}/settlement`, label: '期間結算', icon: Receipt },
  { href: (id) => `/merchants/${id}/ledger`, label: '動作流水', icon: ClipboardList },
];

export function MerchantOperationsHub({ merchantId }: { merchantId: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {actions.map(({ href, label, icon: Icon }) => (
        <Button
          key={label}
          asChild
          variant="outline"
          className="h-auto flex-col gap-2 rounded-xl border-border/70 bg-background py-4 shadow-none hover:bg-muted/50 hover:shadow-card"
        >
          <Link href={href(merchantId)}>
            <Icon className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium text-navy">{label}</span>
          </Link>
        </Button>
      ))}
    </div>
  );
}
