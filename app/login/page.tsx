import { LoginForm } from './login-form';

export const metadata = {
  title: '登入 · Furmosa HQ',
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden bg-ink px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="relative flex flex-col leading-tight">
          <p className="font-display text-lg font-semibold tracking-tight">Furmosa</p>
          <p className="mt-1 text-sm text-white/55">總部管理系統</p>
        </div>
        <div className="relative max-w-md space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
            Operations
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            清楚掌握訂單、庫存與出貨狀態
          </h1>
          <p className="text-sm leading-relaxed text-white/60">
            黑白高對比工作台：數字用黑卡強調，操作留在白卡裡。
          </p>
        </div>
        <p className="relative text-xs text-white/40">© Furmosa 2026</p>
      </div>

      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col gap-1 text-center lg:hidden">
            <h1 className="font-display text-xl font-semibold text-ink">Furmosa HQ</h1>
            <p className="text-sm text-muted-foreground">總部管理系統</p>
          </div>
          <div className="bento-card p-5">
            <LoginForm next={searchParams.next} />
          </div>
          <div className="bento-card p-4 text-xs text-muted-foreground">
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
