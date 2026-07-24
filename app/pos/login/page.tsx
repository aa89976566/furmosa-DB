import { Suspense } from 'react';
import { PosLoginForm } from './login-form';
import { Store } from 'lucide-react';

export const metadata = {
  title: '店家登入 · Furmosa',
};

/** 靜態殼層 → CDN 可 HIT（?next= 改客戶端讀取） */
export const dynamic = 'force-static';
export const revalidate = 3600;

export default function PosLoginPage() {
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
      <Suspense
        fallback={
          <div className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
            <div className="space-y-4">
              <div className="h-11 animate-pulse rounded-md bg-muted" />
              <div className="h-11 animate-pulse rounded-md bg-muted" />
              <div className="h-11 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        }
      >
        <PosLoginForm />
      </Suspense>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        問題請聯繫 Furmosa 總部
      </p>
    </div>
  );
}
