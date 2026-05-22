'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export function MerchantBackButton({ merchantId }: { merchantId: string }) {
  const pathname = usePathname();
  const overviewPath = `/merchants/${merchantId}`;
  const isOverview = pathname === overviewPath;

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={isOverview ? '/merchants' : overviewPath}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        {isOverview ? '返回列表' : '返回總覽'}
      </Link>
    </Button>
  );
}
