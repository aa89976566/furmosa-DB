import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { shippingFeeTypeLabel } from '@/lib/labels';
import { QuotationPdfDownloadButton } from '@/components/orders/quotation-pdf-download-button';

export const dynamic = 'force-dynamic';

export default async function MerchantQuotationPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ download?: string }>;
}) {
  const [{ id }, searchParams, user] = await Promise.all([
    props.params,
    props.searchParams,
    getCurrentUser(),
  ]);
  if (!user) notFound();

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      merchant: true,
      items: true,
    },
  });

  if (
    !order ||
    !order.merchant ||
    !order.merchantId ||
    order.merchantOrderMode !== 'wholesale' ||
    order.status !== 'confirmed' ||
    order.deletedAt ||
    order.archivedAt
  ) {
    notFound();
  }

  const quoteNumber = `QT-${order.orderNumber}`;
  const billableItems = order.items.filter((item) => !item.isGift);

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-white px-5 py-8 text-slate-950 sm:px-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/orders/${order.id}`} className="text-sm font-medium underline underline-offset-4">
          返回訂單
        </Link>
        <QuotationPdfDownloadButton autoStart={searchParams?.download === '1'} />
      </div>

      <article className="border border-slate-300 bg-white p-6 shadow-sm sm:p-10 print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-950 pb-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em]">FURMOSA</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">買斷報價單</h1>
            <p className="mt-2 text-sm text-slate-600">確認訂單之成交條件與應收明細</p>
          </div>
          <dl className="shrink-0 text-right text-sm">
            <div><dt className="text-slate-500">報價單號</dt><dd className="mt-1 font-mono font-semibold">{quoteNumber}</dd></div>
            <div className="mt-3"><dt className="text-slate-500">確認日期</dt><dd className="mt-1 font-medium">{formatDateTime(order.orderedAt)}</dd></div>
          </dl>
        </header>

        <section className="grid gap-6 border-b border-slate-200 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500">報價對象</p>
            <p className="mt-2 text-lg font-semibold">{order.merchant.name}</p>
            {order.merchant.contactName ? <p className="mt-1 text-sm">{order.merchant.contactName}</p> : null}
            {order.merchant.phone ? <p className="mt-1 text-sm text-slate-600">{order.merchant.phone}</p> : null}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold tracking-wide text-slate-500">合作方式</p>
            <p className="mt-2 text-lg font-semibold">買斷</p>
            <p className="mt-1 text-sm text-slate-600">單價依確認當下的店家特約、商品規格與數量級距計算</p>
          </div>
        </section>

        <section className="py-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-300 text-left text-xs text-slate-500">
                <th className="py-3 pr-3 font-semibold">商品</th>
                <th className="py-3 pr-3 font-semibold">SKU</th>
                <th className="py-3 pr-3 text-right font-semibold">數量</th>
                <th className="py-3 pr-3 text-right font-semibold">買斷單價</th>
                <th className="py-3 text-right font-semibold">小計</th>
              </tr>
            </thead>
            <tbody>
              {billableItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-200 align-top">
                  <td className="py-4 pr-3 font-medium">
                    {item.productName}
                    {item.variantKey ? <span className="mt-1 block text-xs font-normal text-slate-500">{item.variantKey}</span> : null}
                  </td>
                  <td className="py-4 pr-3 font-mono text-xs text-slate-600">{item.sku || '—'}</td>
                  <td className="py-4 pr-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-4 pr-3 text-right tabular-nums">{formatCurrency(Number(item.unitPrice))}</td>
                  <td className="py-4 text-right font-medium tabular-nums">{formatCurrency(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="ml-auto w-full max-w-sm border-t border-slate-300 pt-4 text-sm">
          <div className="flex justify-between gap-6 py-1"><span className="text-slate-600">商品小計</span><span className="tabular-nums">{formatCurrency(Number(order.subtotal))}</span></div>
          {Number(order.discount) > 0 ? <div className="flex justify-between gap-6 py-1"><span className="text-slate-600">折扣</span><span className="tabular-nums">−{formatCurrency(Number(order.discount))}</span></div> : null}
          <div className="flex justify-between gap-6 py-1"><span className="text-slate-600">運費（{shippingFeeTypeLabel[order.shippingFeeType] ?? order.shippingFeeType}）</span><span className="tabular-nums">{formatCurrency(Number(order.shippingFee))}</span></div>
          <div className="mt-3 flex justify-between gap-6 border-t-2 border-slate-950 pt-3 text-lg font-semibold"><span>應收合計</span><span className="tabular-nums">{formatCurrency(Number(order.total))}</span></div>
        </section>

        <footer className="mt-12 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
          <p>本文件依訂單 {order.orderNumber} 確認時保存的成交快照產生；日後商品設定或店家價格調整不回溯修改此報價內容。</p>
          {order.note ? <p className="mt-2">訂單備註：{order.note}</p> : null}
        </footer>
      </article>
    </main>
  );
}
