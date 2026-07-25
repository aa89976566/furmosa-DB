import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { appointmentStatusLabelForCustomer } from '@/lib/booking/constants';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';

export const metadata = { title: '預約已送出 · Furmosa' };

export default async function PublicBookDonePage({
  params,
  searchParams,
}: {
  params: { merchantKey: string };
  searchParams?: { id?: string };
}) {
  const id = searchParams?.id;
  const row = id
    ? await prisma.appointment.findFirst({
        where: { id },
        include: { merchant: { select: { name: true } } },
      })
    : null;

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold text-navy">預約已送出</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        請等待店家確認。確認後會再通知你（LINE 通知下一輪才會接上）。
      </p>
      {row ? (
        <div className="mt-6 space-y-2 rounded-xl border p-4 text-sm">
          <p className="font-medium">{row.merchant.name}</p>
          <p>
            {formatLocalDate(row.startsAt)} {formatLocalTime(row.startsAt)}
          </p>
          <p>{row.serviceName}</p>
          <p className="text-muted-foreground">
            {appointmentStatusLabelForCustomer(row.status)}
          </p>
        </div>
      ) : null}
      <Link
        href={`/book/${params.merchantKey}`}
        className="mt-8 inline-block text-sm text-primary"
      >
        再預約一次
      </Link>
    </div>
  );
}
