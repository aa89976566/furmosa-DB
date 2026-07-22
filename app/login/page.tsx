import { LoginForm } from './login-form';
import { PawPrint } from 'lucide-react';

export const metadata = {
  title: '登入 · Furmosa HQ',
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-navy px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.28),transparent_48%),radial-gradient(ellipse_at_bottom_right,hsl(211_78%_46%/0.16),transparent_40%)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <PawPrint className="h-4 w-4" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">Furmosa</p>
            <p className="text-xs text-white/65">HQ Admin</p>
          </div>
        </div>
        <div className="relative max-w-md space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Operations
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            清楚掌握訂單、庫存與出貨狀態
          </h1>
          <p className="text-sm leading-relaxed text-white/70">
            Linear 式密度與節奏、Mixpanel 式分析色調、Polaris 式後台階層，讓營運、財務與物流在同一套系統快速協作。
          </p>
        </div>
        <p className="relative text-xs text-white/45">© Furmosa 2026</p>
      </div>

      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-5">
          <div className="flex flex-col items-center gap-2 text-center lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <PawPrint className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-navy">Furmosa HQ</h1>
              <p className="text-sm text-muted-foreground">總部管理系統</p>
            </div>
          </div>
          <LoginForm next={searchParams.next} />
          <div className="rounded-md border border-border/70 bg-card p-3.5 text-xs text-muted-foreground shadow-xs">
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
