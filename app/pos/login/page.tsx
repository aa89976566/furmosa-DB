import { PosLoginForm } from './login-form';
import { Store } from 'lucide-react';

export const metadata = {
  title: '店家登入 · Furmosa',
};

export default function PosLoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card">
          <Store className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-navy">Furmosa 店家登入</h1>
          <p className="text-sm text-muted-foreground">請使用總部提供的店家帳號</p>
        </div>
      </div>
      <PosLoginForm next={searchParams.next} />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        問題請聯繫 Furmosa 總部
      </p>
    </div>
  );
}
