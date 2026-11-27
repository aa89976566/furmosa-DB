import { BookingForm } from './booking-form';

export const metadata = { title: 'Cynthia 西亞｜動物溝通預約・匠寵' };
export const dynamic = 'force-dynamic';

export default async function CynthiaBookingPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const { submitted } = await searchParams;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return (
    <main className="group mx-auto max-w-xl space-y-3 bg-white px-4 py-3 font-sans text-[#151c43] sm:py-10">
      <header className="space-y-2 max-sm:group-has-[[data-booking-step]:not([data-booking-step='0'])]:sr-only">
        <p className="text-sm font-semibold">Cynthia 西亞</p>
        <h1 className="text-[28px] font-bold leading-tight">動物溝通預約</h1>
        <p>選擇服務與時段，完成付款後，匠寵會透過 LINE 聯繫。</p>
      </header>
      {submitted === '1' ? (
        <p className="rounded-xl border p-5" role="status">已收到預約申請。完成付款後，匠寵會透過 LINE 與你確認預約。</p>
      ) : (
        <BookingForm today={today} />
      )}
    </main>
  );
}
