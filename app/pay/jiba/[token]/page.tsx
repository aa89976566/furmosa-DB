import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  APP_STATUS,
  JIBA_BANK_TRANSFER,
  JIBA_SHIPPING_FEE,
  JIBA_SUPERVISOR_NAME,
} from '@/lib/campaigns/jiba-two-piece/constants';

export const dynamic = 'force-dynamic';

/** 轉帳說明頁（無線上金流）。入帳由壽司匠在後台確認。 */
export default async function JibaPayPage({ params }: { params: { token: string } }) {
  const app = await prisma.campaignApplication.findUnique({
    where: { paymentToken: params.token },
    include: { campaign: true },
  });
  if (!app) notFound();

  const alreadyPaid =
    app.paymentStatus === 'paid' || app.status === APP_STATUS.READY_TO_SHIP;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div>
        <p className="text-sm tracking-wide text-emerald-800/80">匠寵 Furmosa</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">雞霸運費轉帳</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {app.campaign.name}
          <br />
          商品金額 NT$0 · 7-11 運費 NT${JIBA_SHIPPING_FEE}
        </p>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-gradient-to-b from-emerald-50/80 to-white p-5 shadow-sm">
        <p className="text-3xl font-semibold">NT${JIBA_SHIPPING_FEE}</p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700">
          銀行：{JIBA_BANK_TRANSFER.bankName}（{JIBA_BANK_TRANSFER.bankCode}）
          <br />
          帳號：{JIBA_BANK_TRANSFER.account}
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          收件：{app.recipientName || '—'} · {app.storeName || '—'}
        </p>
      </div>
      {alreadyPaid ? (
        <p className="rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
          錢到了。雞霸準備離家。
        </p>
      ) : (
        <p className="rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
          轉帳完成後，請回 LINE 傳「我已轉帳」，或「找{JIBA_SUPERVISOR_NAME}」。
          小幫手對帳後會安排出貨。
        </p>
      )}
    </main>
  );
}
