import { Suspense } from 'react';
import { LoginForm } from './login-form';
import { PawPrint } from 'lucide-react';

export const metadata = {
  title: '登入 · Furmosa HQ',
};

/** 靜態殼層 → Vercel CDN 可 HIT（對齊最快網站的可快取 HTML） */
export const dynamic = 'force-static';
export const revalidate = 3600;

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden bg-navy px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.35),transparent_42%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.22),transparent_36%)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card">
            <PawPrint className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">Furmosa HQ</p>
            <p className="text-sm text-white/70">總部管理系統</p>
          </div>
        </div>
        <div className="relative max-w-md space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Operations</p>
          <h1 className="text-4xl font-semibold tracking-tight">清楚掌握訂單、庫存與出貨狀態</h1>
          <p className="text-sm leading-relaxed text-white/72">
            以清楚分色與卡片式資訊層級，讓營運、財務與物流在同一套後台快速協作。
          </p>
        </div>
        <p className="relative text-xs text-white/50">© Furmosa 2026</p>
      </div>

      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-2 text-center lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card">
              <PawPrint className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-navy">Furmosa HQ</h1>
              <p className="text-sm text-muted-foreground">總部管理系統</p>
            </div>
          </div>
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>
          <div className="rounded-2xl border border-border/70 bg-card p-4 text-xs text-muted-foreground shadow-card">
            <p className="mb-1 font-medium text-foreground">測試帳號（密碼皆為 furmosa2026）</p>
            <ul className="space-y-0.5 font-mono">
              <li>admin@furmosa.com</li>
              <li>finance@furmosa.com</li>
              <li>ops@furmosa.com</li>
              <li>wh@furmosa.com</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
      <div className="space-y-4">
        <div className="h-9 animate-pulse rounded-md bg-muted" />
        <div className="h-9 animate-pulse rounded-md bg-muted" />
        <div className="h-10 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
