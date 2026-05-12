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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <PawPrint className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Furmosa HQ</h1>
            <p className="text-sm text-muted-foreground">總部管理系統</p>
          </div>
        </div>
        <LoginForm next={searchParams.next} />
        <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground">
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
  );
}
