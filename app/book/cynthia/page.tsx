import { BookingForm } from './booking-form';

export const metadata = { title: 'Cynthia 西亞｜動物溝通預約・匠寵' };
export const dynamic = 'force-dynamic';

export default async function CynthiaBookingPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const { submitted } = await searchParams;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return (
    <main className="mx-auto max-w-xl space-y-6 px-5 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Cynthia 西亞｜動物溝通預約</h1>
        <p>選擇服務並提供方便的日期，匠寵會以電子郵件聯繫你確認。</p>
      </header>
      {submitted === '1' ? (
        <p className="rounded-xl border p-5" role="status">已收到預約申請。請留意匠寵的確認信，時段以客服回覆為準。</p>
      ) : <BookingForm today={today} />}
    </main>
  );
}
