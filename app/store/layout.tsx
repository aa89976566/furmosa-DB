import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '店家驗證 · Furmosa',
  description: '合作美容院優惠券核銷',
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Furmosa</p>
          <h1 className="text-lg font-bold text-navy">店家驗證優惠券</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
