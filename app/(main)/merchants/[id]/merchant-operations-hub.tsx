import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
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

/**
 * 「快速動作」面板 — 對齊 Shopify Admin 的 quick-action grid。
 * 只放 icon + 標題 + 連結，不放任何說明文字；說明請放在子頁籤內。
 */
export function MerchantOperationsHub({ merchantId }: { merchantId: string }) {
  const actions = [
    {
      href: `/merchants/${merchantId}/restock`,
      label: '進貨入庫',
      icon: PackagePlus,
    },
    {
      href: `/merchants/${merchantId}/adjust?mode=sold`,
      label: '登記賣出',
      icon: ScanLine,
    },
    {
      href: `/merchants/${merchantId}/adjust?mode=count`,
      label: '盤點剩餘',
      icon: Boxes,
    },
    {
      href: `/merchants/${merchantId}/sale`,
      label: '建立訂單',
      icon: ShoppingCart,
    },
    {
      href: `/merchants/${merchantId}/rule`,
      label: '分潤規則',
      icon: BookOpen,
    },
    {
      href: `/merchants/${merchantId}/shipments`,
      label: '運送狀態',
      icon: Truck,
    },
    {
      href: `/merchants/${merchantId}/settlement`,
      label: '期間結算',
      icon: Receipt,
    },
    {
      href: `/merchants/${merchantId}/ledger`,
      label: '動作流水',
      icon: ClipboardList,
    },
  ];

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-8">
        {actions.map(({ href, label, icon: Icon }) => (
          <Button
            key={href}
            asChild
            variant="ghost"
            className="flex h-auto flex-col gap-2 py-4"
          >
            <Link href={href}>
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
