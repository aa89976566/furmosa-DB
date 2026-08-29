import { PosLoginForm } from './login-form';

export const metadata = {
  title: '店家登入 · Furmosa',
};

export default function PosLoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string; username?: string };
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground shadow-card">
          F
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-primary">Furmosa</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy">店家登入</h1>
          <p className="mt-1 text-sm text-muted-foreground">請使用總部提供的店家帳號</p>
        </div>
      </div>
      <PosLoginForm
        next={searchParams.next}
        error={searchParams.error}
        username={searchParams.username}
      />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        問題請聯繫 Furmosa 總部
      </p>
    </div>
  );
}
