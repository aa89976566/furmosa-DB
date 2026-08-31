import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { MerchantPosAccessForm } from '@/components/merchants/merchant-pos-access-form';
import { MerchantWorkspace } from '@/components/merchants/merchant-ui';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function MerchantPosAccessPage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      merchantId: true,
      name: true,
      users: {
        where: { isActive: true },
        select: { username: true, displayName: true },
        take: 1,
      },
    },
  });
  if (!merchant) notFound();

  const account = merchant.users[0];
  return (
    <MerchantWorkspace narrow className="py-10">
      <section className="overflow-hidden rounded-3xl border-2 border-neutral-900 bg-white px-5 py-7 text-neutral-950 shadow-[6px_6px_0_0_#111] sm:px-7">
        {account ? (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-neutral-500">{merchant.merchantId}</p>
              <h1 className="mt-1 text-2xl font-bold">{merchant.name} 已有 POS 帳號</h1>
            </div>
            <dl className="rounded-2xl border-2 border-neutral-900 px-4 py-3">
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-sm text-neutral-500">登入帳號</dt>
                <dd className="font-semibold">{account.username}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-sm text-neutral-500">顯示名稱</dt>
                <dd className="font-semibold">{account.displayName || '未設定'}</dd>
              </div>
            </dl>
            <p className="text-sm leading-6 text-neutral-600">為避免同一門市出現多組混用帳號，第一版維持一店一個使用中帳號。</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="outline" className="h-12 flex-1 border-2 border-neutral-950"><Link href={`/merchants/${merchant.id}`}>完成</Link></Button>
              <Button asChild className="h-12 flex-1 bg-neutral-950 text-white"><Link href="/pos/login" target="_blank">開啟 POS 登入頁<ExternalLink className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </div>
        ) : (
          <MerchantPosAccessForm merchantId={merchant.id} merchantName={merchant.name} />
        )}
      </section>
    </MerchantWorkspace>
  );
}
