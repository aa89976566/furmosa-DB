import { BookingForm } from './booking-form';

export const metadata = { title: 'Cynthia 西亞｜動物溝通預約・匠寵' };
export const dynamic = 'force-dynamic';

export default async function CynthiaBookingPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const { submitted } = await searchParams;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <h1 className="sr-only">Cynthia 西亞｜動物溝通預約</h1>
      {submitted === '1' ? (
        <section className="space-y-2 rounded-xl bg-[#fff9df] p-5 text-neutral-950" role="status">
          <h2 className="text-xl font-bold">已收到預約申請</h2>
          <p>匠寵會以 Email 確認日期與付款方式。</p>
        </section>
      ) : <BookingForm today={today} />}
    </main>
  );
}
