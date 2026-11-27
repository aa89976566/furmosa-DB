import { BookingForm } from './booking-form';

export const metadata = { title: 'Cynthia 西亞｜動物溝通預約・匠寵' };
export const dynamic = 'force-dynamic';

export default async function CynthiaBookingPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const { submitted } = await searchParams;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return (
    <main className="mx-auto max-w-xl space-y-6 bg-white px-5 py-6 font-sans text-[#151c43] sm:py-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold">Cynthia 西亞</p>
        <h1 className="text-[28px] font-bold leading-tight">動物溝通預約</h1>
        <p>選擇服務並提供方便的日期，匠寵會以電子郵件聯繫你確認。</p>
      </header>
      {submitted === '1' ? (
        <p className="rounded-xl border p-5" role="status">已收到預約申請。請留意匠寵的確認信，時段以客服回覆為準。</p>
      ) : (
        <>
          <section className="space-y-3 border-b border-[#ded9cf] pb-4" aria-labelledby="booking-procedure">
            <h2 id="booking-procedure" className="font-bold">預約流程</h2>
            <ol className="grid grid-cols-3 gap-2">
              {['選服務與時段', '等待 Email 確認', '確認後付款'].map((step, index) => (
                <li key={step} className="flex items-start gap-1.5 text-sm leading-5">
                  <span aria-hidden="true" className="inline-grid size-5 shrink-0 place-items-center rounded bg-[#ffe071] font-bold">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm">即時線上選兩組候選時段，非即時圖文選期望交付日。</p>
          </section>
          <BookingForm today={today} />
        </>
      )}
    </main>
  );
}
