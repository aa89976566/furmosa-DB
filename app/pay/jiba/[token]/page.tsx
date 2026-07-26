import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { APP_STATUS, JIBA_SHIPPING_FEE } from '@/lib/campaigns/jiba-two-piece/constants';
import { JibaPayClient } from './pay-client';

export const dynamic = 'force-dynamic';

export default async function JibaPayPage({ params }: { params: { token: string } }) {
  const app = await prisma.campaignApplication.findUnique({
    where: { paymentToken: params.token },
    include: { campaign: true },
  });
  if (!app) notFound();

  const alreadyPaid =
    app.paymentStatus === 'paid' || app.status === APP_STATUS.READY_TO_SHIP;
  const canPay =
    !alreadyPaid &&
    (app.status === APP_STATUS.AWAITING_SHIPPING_PAYMENT ||
      app.status === APP_STATUS.APPROVED);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div>
        <p className="text-sm tracking-wide text-emerald-800/80">匠寵 Furmosa</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">雞霸運費</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {app.campaign.name}
          <br />
          商品金額 NT$0 · 7-11 運費 NT${JIBA_SHIPPING_FEE}
        </p>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-gradient-to-b from-emerald-50/80 to-white p-5 shadow-sm">
        <p className="text-3xl font-semibold">NT${JIBA_SHIPPING_FEE}</p>
        <p className="mt-1 text-sm text-neutral-500">
          收件：{app.recipientName || '—'} · {app.storeName || '—'}
        </p>
        {app.petName ? (
          <p className="mt-1 text-sm text-neutral-500">毛孩：{app.petName}</p>
        ) : null}
      </div>
      <JibaPayClient
        token={params.token}
        canPay={canPay}
        alreadyPaid={alreadyPaid}
        amount={JIBA_SHIPPING_FEE}
      />
      <p className="text-center text-xs text-neutral-400">
        付款完成後才會排入出貨。綠界正式金流串接前，此頁為安全確認付款入口。
      </p>
    </main>
  );
}
