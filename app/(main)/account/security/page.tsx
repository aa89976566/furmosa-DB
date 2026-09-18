import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revokePasskey } from './actions';
import { PasskeyManager } from './passkey-manager';

function formatDate(value: Date | null) {
  if (!value) return '尚未使用';
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(value);
}

export default async function AccountSecurityPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/login?next=/account/security');
  const passkeys = await prisma.hqPasskeyCredential.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <PageHeader title="Face ID 登入" description="只適用 Furmosa HQ，不會影響店家 POS 帳號。" compact />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
          <div>
            <h2 className="font-semibold">新增這台裝置</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              iPhone 會使用 Face ID；系統只保存公開金鑰，不會取得或保存臉部資料。
            </p>
          </div>
          <PasskeyManager />
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-card">
          <div>
            <h2 className="font-semibold">已啟用裝置</h2>
            <p className="mt-1 text-sm text-muted-foreground">遺失或不再使用的裝置請立即撤銷。</p>
          </div>
          {passkeys.length === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">尚未啟用 Face ID</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {passkeys.map((passkey) => (
                <li key={passkey.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{passkey.deviceName}</p>
                    <p className="text-xs text-muted-foreground">最近使用：{formatDate(passkey.lastUsedAt)}</p>
                  </div>
                  <form action={revokePasskey}>
                    <input type="hidden" name="id" value={passkey.id} />
                    <Button type="submit" size="sm" variant="outline">撤銷</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted-foreground">密碼登入會保留，換手機或 Face ID 無法使用時仍可登入。</p>
      </div>
    </div>
  );
}

