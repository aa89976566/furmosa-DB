import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import {
  APP_STATUS,
  JIBA_CAMPAIGN_SLUG,
  jibaProductLabelFromCollected,
} from '@/lib/campaigns/jiba-two-piece/constants';
import { isMissingCampaignTableError } from '@/lib/campaigns/jiba-two-piece/missing-table';
import { ensureJibaCampaign } from '@/lib/campaigns/jiba-two-piece/service';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  [APP_STATUS.COLLECTING_INFO]: '收集中',
  [APP_STATUS.PENDING_REVIEW]: '待審核',
  [APP_STATUS.APPROVED]: '已通過',
  [APP_STATUS.AWAITING_SHIPPING_PAYMENT]: '等運費',
  [APP_STATUS.READY_TO_SHIP]: '待出貨',
  [APP_STATUS.REJECTED]: '已拒絕',
  [APP_STATUS.CANCELLED_BY_USER]: '顧客取消',
  [APP_STATUS.CANCELLED]: '已取消',
};

function SchemaNotReady({ detail }: { detail?: string }) {
  return (
    <>
      <PageHeader
        title="UGC 審核"
        description="活動資料表尚未就緒，無法載入申請列表。"
      />
      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
            <p>
              生產環境可能尚未套用開箱活動 migration（
              <code className="font-mono text-xs">20260726140000_ugc_campaign_unbox</code>
              ）。系統已嘗試自動補表；若持續失敗，請在有 DIRECT_URL 的環境執行{' '}
              <code className="font-mono text-xs">npx prisma migrate deploy</code>。
            </p>
            {detail ? (
              <p className="font-mono text-xs break-all text-destructive/80">{detail}</p>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">返回 Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default async function JibaReviewListPage() {
  try {
    const campaign = await ensureJibaCampaign();
    const apps = await prisma.campaignApplication.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        conversationSession: {
          select: { id: true, currentState: true, collectedDataJson: true },
        },
      },
    });

    const pending = apps.filter((a) => a.status === APP_STATUS.PENDING_REVIEW);

    return (
      <>
        <PageHeader
          title="UGC 審核"
          description={`${campaign.name}（${JIBA_CAMPAIGN_SLUG}）— 審核通過且免運／已申報轉帳後進入出貨列表；尚未轉帳會留在等付款，不會消失。`}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/reviews">返回待審核</Link>
            </Button>
          }
        />
        <div className="space-y-6 p-6">
          <Card>
            <CardContent className="flex flex-wrap gap-4 p-4 text-sm">
              <div>
                待審核 <span className="font-semibold">{pending.length}</span>
              </div>
              <div className="text-muted-foreground">全部 {apps.length}</div>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">申請時間</th>
                  <th className="px-3 py-2">LINE</th>
                  <th className="px-3 py-2">商品</th>
                  <th className="px-3 py-2">收件／門市</th>
                  <th className="px-3 py-2">IG／毛孩</th>
                  <th className="px-3 py-2">狀態</th>
                  <th className="px-3 py-2">付款</th>
                  <th className="px-3 py-2">出貨列</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {apps.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                      還沒有申請
                    </td>
                  </tr>
                ) : (
                  apps.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDateTime(a.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{a.lineDisplayName || '—'}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {a.lineUserId}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {jibaProductLabelFromCollected(
                          a.conversationSession?.collectedDataJson,
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div>{a.recipientName || '—'}</div>
                        <div className="text-muted-foreground">{a.storeName || '—'}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{a.instagramHandle || '—'}</div>
                        <div className="text-muted-foreground">{a.petName || '—'}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            a.status === APP_STATUS.PENDING_REVIEW ? 'default' : 'muted'
                          }
                        >
                          {STATUS_LABEL[a.status] ?? a.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {a.paymentStatus}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {a.shippingQueueStatus}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/campaigns/jiba-two-piece/${a.id}`}
                          className="text-sm font-medium text-navy underline-offset-2 hover:underline"
                        >
                          審核
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  } catch (err) {
    console.error('[jiba-review-list]', err);
    if (isMissingCampaignTableError(err)) {
      return (
        <SchemaNotReady
          detail={err instanceof Error ? err.message.slice(0, 280) : undefined}
        />
      );
    }
    throw err;
  }
}
