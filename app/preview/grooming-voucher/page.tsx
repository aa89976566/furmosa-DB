import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { PosGroomingVoucherPreviewApp } from '@/components/grooming-voucher-preview/pos-preview-app';
import { PreviewBanner } from '@/components/grooming-voucher-preview/preview-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  evaluatePageAccess,
  GROOMING_PREVIEW_COOKIE_NAME,
  GROOMING_PREVIEW_GENERIC_ERROR,
  readPreviewAuthEnv,
} from '@/lib/grooming-voucher-preview/preview-auth';
import { loginAction, logoutAction } from './actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default function GroomingVoucherPreviewPage({
  searchParams,
}: {
  searchParams: { e?: string };
}) {
  const access = evaluatePageAccess({
    env: readPreviewAuthEnv(process.env),
    cookieValue: cookies().get(GROOMING_PREVIEW_COOKIE_NAME)?.value,
    nowMs: Date.now(),
  });

  if (access === 'not_found') notFound();

  if (access === 'app') {
    return (
      <div className="min-h-screen bg-canvas">
        <form
          action={logoutAction}
          className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-2.5 sm:px-6"
        >
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">預覽已解鎖</p>
          <Button type="submit" variant="outline" className="h-11 min-h-[44px] px-4">
            登出
          </Button>
        </form>
        <PosGroomingVoucherPreviewApp />
      </div>
    );
  }

  return <PreviewLoginForm failed={searchParams.e === '1'} />;
}

function PreviewLoginForm({ failed }: { failed: boolean }) {
  return (
    <div className="min-h-screen bg-canvas">
      <PreviewBanner />
      <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Preview</p>
          <h1 className="text-2xl font-semibold text-navy">美容券預覽</h1>
          <p className="text-sm text-muted-foreground">這是預覽鎖，不是店家或總部登入。</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <form action={loginAction} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="username" className="text-sm font-medium">
                  帳號
                </label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="h-11 min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  密碼
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-11 min-h-[44px]"
                />
              </div>
              {failed ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {GROOMING_PREVIEW_GENERIC_ERROR}
                </p>
              ) : null}
              <Button type="submit" className="h-11 w-full min-h-[44px]">
                進入預覽
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          僅限指定 Preview 環境。不會寫入正式資料。
        </p>
      </div>
    </div>
  );
}
