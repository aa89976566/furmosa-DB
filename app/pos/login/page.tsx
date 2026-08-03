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
    <div className="pos-atmosphere mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-8 space-y-3">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Furmosa
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-ink">
          店家登入
        </h1>
        <p className="text-sm text-muted-foreground">使用總部提供的帳號</p>
      </div>
      <PosLoginForm next={searchParams.next} />
      <p className="mt-8 text-center text-xs text-muted-foreground">問題請聯繫 Furmosa 總部</p>
    </div>
  );
}
