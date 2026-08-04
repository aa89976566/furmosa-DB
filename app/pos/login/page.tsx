import { PosLoginForm } from './login-form';

export const metadata = {
  title: '店家登入 · Furmosa',
};

export default function PosLoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(110%_80%_at_20%_-10%,hsl(var(--coral)/0.18),transparent_55%)]"
      />
      <div className="relative mb-7 pos-fade-in">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-coral">Furmosa</p>
        <h1 className="mt-2 font-pos text-[1.85rem] font-semibold leading-tight tracking-tight text-navy">
          店家登入
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">用總部給你的帳號開始今天</p>
      </div>
      <div className="relative pos-fade-in" style={{ animationDelay: '60ms' }}>
        <PosLoginForm next={searchParams.next} />
      </div>
      <p className="relative mt-6 text-center text-xs text-muted-foreground">
        問題請聯繫 Furmosa 總部
      </p>
    </div>
  );
}
