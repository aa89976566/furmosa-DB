import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { MerchantSection, MerchantWorkspace } from '@/components/merchants/merchant-ui';
import { getCurrentUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { CreateMerchantAccountForm, ExistingMerchantAccountForms } from './account-forms';

export const dynamic = 'force-dynamic';

export default async function MerchantAccountPage({ params }: { params: { id: string } }) {
  const [merchant, currentUser] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        users: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, username: true, displayName: true, isActive: true, lastLoginAt: true, createdAt: true },
        },
      },
    }),
    getCurrentUser(),
  ]);
  if (!merchant) notFound();
  const account = merchant.users[0] ?? null;
  const canManage = currentUser?.role === 'admin';

  return (
    <MerchantWorkspace>
      <MerchantSection title="POS 帳號" description="管理這家店登入店家 POS 的帳號">
        {account ? (
          <div className="space-y-6">
            <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/20 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">登入帳號</p><p className="mt-1 font-mono font-semibold">{account.username}</p></div>
              <div><p className="text-xs text-muted-foreground">使用者名稱</p><p className="mt-1 font-medium">{account.displayName || '未填寫'}</p></div>
              <div><p className="text-xs text-muted-foreground">狀態</p><div className="mt-1"><Badge variant={account.isActive ? 'success' : 'secondary'}>{account.isActive ? '使用中' : '已停用'}</Badge></div></div>
              <div><p className="text-xs text-muted-foreground">最後登入</p><p className="mt-1 font-medium">{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : '尚未登入'}</p></div>
            </div>
            {merchant.users.length > 1 ? <p className="text-sm text-warning">此店家有 {merchant.users.length} 個既有帳號；第一階段只管理最早建立的帳號，請由工程人員確認其餘帳號。</p> : null}
            {canManage ? <ExistingMerchantAccountForms merchantId={merchant.id} accountId={account.id} isActive={account.isActive} /> : <p className="text-sm text-muted-foreground">只有 HQ 管理員可以重設密碼或變更帳號狀態。</p>}
          </div>
        ) : merchant.status !== 'active' ? (
          <p className="text-sm text-muted-foreground">這家店目前未啟用，因此不能開通 POS 帳號。</p>
        ) : canManage ? (
          <CreateMerchantAccountForm merchantId={merchant.id} />
        ) : (
          <p className="text-sm text-muted-foreground">尚未開通 POS 帳號。請由 HQ 管理員處理。</p>
        )}
      </MerchantSection>
    </MerchantWorkspace>
  );
}

