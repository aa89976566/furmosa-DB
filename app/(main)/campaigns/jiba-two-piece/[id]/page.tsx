import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import {
  APP_STATUS,
  CATNIP_CHICK_HOMEPAGE_URL,
  JIBA_BANK_TRANSFER,
  JIBA_SHIPPING_FEE,
  JIBA_SUPERVISOR_NAME,
  jibaProductKeyFromCollected,
  jibaProductLabelFromCollected,
} from '@/lib/campaigns/jiba-two-piece/constants';
import { isMissingCampaignTableError } from '@/lib/campaigns/jiba-two-piece/missing-table';
import {
  approveJibaApplicationAction,
  markJibaTransferPaidAction,
  rejectJibaApplicationAction,
  returnJibaApplicationAction,
} from '../actions';

export const dynamic = 'force-dynamic';

function parseMessageText(contentJson: string): string {
  try {
    const o = JSON.parse(contentJson) as { text?: string };
    return o.text ?? contentJson;
  } catch {
    return contentJson;
  }
}

export default async function JibaReviewDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const app = await prisma.campaignApplication
    .findUnique({
      where: { id: params.id },
      include: {
        campaign: true,
        conversationSession: {
          include: {
            messages: { orderBy: { sentAt: 'asc' } },
          },
        },
        reviews: { orderBy: { createdAt: 'desc' } },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    })
    .catch((err: unknown) => {
      console.error('[jiba-review-detail]', err);
      if (isMissingCampaignTableError(err)) notFound();
      throw err;
    });
  if (!app) notFound();

  const order = app.orderId
    ? await prisma.order.findUnique({ where: { id: app.orderId } })
    : null;

  const previousCount = await prisma.campaignApplication.count({
    where: {
      campaignId: app.campaignId,
      lineUserId: app.lineUserId,
      id: { not: app.id },
    },
  });
  const duplicateActive = await prisma.campaignApplication.count({
    where: {
      campaignId: app.campaignId,
      lineUserId: app.lineUserId,
      id: { not: app.id },
      status: {
        in: [
          APP_STATUS.COLLECTING_INFO,
          APP_STATUS.PENDING_REVIEW,
          APP_STATUS.AWAITING_SHIPPING_PAYMENT,
          APP_STATUS.READY_TO_SHIP,
        ],
      },
    },
  });

  const canReview = app.status === APP_STATUS.PENDING_REVIEW;
  const session = app.conversationSession;
  const collected = session?.collectedDataJson ?? '{}';
  const productKey = jibaProductKeyFromCollected(collected);
  const productLabel = jibaProductLabelFromCollected(collected);
  const purposeAcknowledged = (() => {
    try {
      const data = JSON.parse(collected) as { purposeAcknowledged?: unknown };
      return data.purposeAcknowledged === true;
    } catch {
      return false;
    }
  })();

  return (
    <>
      <PageHeader
        title="開箱申請審核"
        description={`${app.campaign.name} · ${app.lineDisplayName || app.lineUserId}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/campaigns/jiba-two-piece">返回列表</Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">顧客資料</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="LINE 顯示名稱" value={app.lineDisplayName || '—'} />
              <Row label="LINE userId" value={app.lineUserId} mono />
              <Row label="收件人" value={app.recipientName || '—'} />
              <Row label="手機" value={app.recipientPhone || '—'} />
              <Row
                label="7-11 門市"
                value={[
                  app.storeName,
                  app.storeId ? `店號 ${app.storeId}` : null,
                  app.storeAddress,
                ]
                  .filter(Boolean)
                  .join(' / ') || '—'}
              />
              <Row label="Instagram" value={app.instagramHandle || '—'} />
              <Row label="毛孩" value={app.petName || '（略過）'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">活動與訂單</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="活動" value={app.campaign.name} />
              <Row label="商品" value={productLabel} />
              <Row label="商品金額" value={`NT$${app.campaign.productUnitPrice}`} />
              <Row label="運費" value={`NT$${app.campaign.shippingFee}`} />
              <Row label="申請時間" value={formatDateTime(app.createdAt)} />
              <Row
                label="授權"
                value={
                  app.licenseAccepted
                    ? `${app.licenseVersion || '—'} @ ${
                        app.licenseAcceptedAt
                          ? formatDateTime(app.licenseAcceptedAt)
                          : '—'
                      }`
                    : '未同意'
                }
              />
              {productKey === 'catnip' ? (
                <>
                  <Row
                    label="用途說明"
                    value={
                      purposeAcknowledged
                        ? `已了解，可能用於 ${CATNIP_CHICK_HOMEPAGE_URL}`
                        : '尚未確認用途'
                    }
                  />
                </>
              ) : null}
              <Row label="過往參加次數" value={String(previousCount)} />
              <Row
                label="重複申請警示"
                value={duplicateActive > 0 ? `⚠ 另有 ${duplicateActive} 筆進行中` : '無'}
              />
              <Row label="申請狀態" value={app.status} mono />
              <Row label="出貨隊列" value={app.shippingQueueStatus} mono />
              <Row label="付款" value={app.paymentStatus} mono />
              {order ? (
                <>
                  <Row label="訂單編號" value={order.orderNumber} mono />
                  <Row label="訂單狀態" value={order.status} mono />
                  <Row label="訂單合計" value={`NT$${order.total}`} />
                </>
              ) : null}
              {session ? (
                <Row
                  label="對話 session"
                  value={session.id}
                  mono
                />
              ) : null}
            </CardContent>
          </Card>

          {canReview ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  審核操作（{JIBA_SUPERVISOR_NAME}）
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <form action={approveJibaApplicationAction} className="space-y-2">
                  <input type="hidden" name="applicationId" value={app.id} />
                  <label className="block text-xs text-muted-foreground">備註（可空）</label>
                  <textarea
                    name="note"
                    rows={2}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="內部備註"
                  />
                  <Button type="submit" className="w-full">
                    通過並詢問轉帳
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    通過後顧客可選「現在付款」看轉帳資訊，或「找{JIBA_SUPERVISOR_NAME}」。
                  </p>
                </form>

                <form action={returnJibaApplicationAction} className="space-y-2 border-t pt-4">
                  <input type="hidden" name="applicationId" value={app.id} />
                  <label className="block text-xs text-muted-foreground">退回欄位</label>
                  <select
                    name="field"
                    required
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    defaultValue="store"
                  >
                    <option value="recipient_name">收件人姓名</option>
                    <option value="recipient_phone">手機號碼</option>
                    <option value="store">7-11 門市</option>
                    <option value="instagram_handle">Instagram</option>
                    <option value="pet_name">毛孩名稱</option>
                    <option value="license">內容授權</option>
                  </select>
                  <select
                    name="reasonCode"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    defaultValue="store_incomplete"
                  >
                    <option value="phone_invalid">手機號碼有誤</option>
                    <option value="store_incomplete">門市資料不完整</option>
                    <option value="ig_not_found">Instagram 帳號找不到</option>
                    <option value="mismatch">資料與對話不一致</option>
                    <option value="duplicate">重複申請</option>
                    <option value="other">其他</option>
                  </select>
                  <textarea
                    name="note"
                    required
                    rows={2}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="退回原因（必填）"
                  />
                  <Button type="submit" variant="secondary" className="w-full">
                    退回修改
                  </Button>
                </form>

                <form action={rejectJibaApplicationAction} className="space-y-2 border-t pt-4">
                  <input type="hidden" name="applicationId" value={app.id} />
                  <textarea
                    name="note"
                    required
                    rows={2}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="內部拒絕原因（必填）"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="notifyCustomer" value="1" defaultChecked />
                    告知顧客（預設名額已滿文案）
                  </label>
                  <Button type="submit" variant="destructive" className="w-full">
                    拒絕申請
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-4 p-4 text-sm text-muted-foreground">
                <p>
                  目前狀態 <Badge variant="muted">{app.status}</Badge>
                  {app.status === APP_STATUS.PENDING_REVIEW
                    ? ''
                    : '，不可再審核通過。'}
                </p>
                {app.reviewNote ? <p>上次備註：{app.reviewNote}</p> : null}
                {app.status === APP_STATUS.AWAITING_SHIPPING_PAYMENT ? (
                  <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-foreground">
                    <p className="font-medium">等待轉帳入帳</p>
                    <p className="text-xs text-muted-foreground">
                      {JIBA_BANK_TRANSFER.bankName}（{JIBA_BANK_TRANSFER.bankCode}）{' '}
                      {JIBA_BANK_TRANSFER.account} · NT${JIBA_SHIPPING_FEE}
                    </p>
                    <form action={markJibaTransferPaidAction}>
                      <input type="hidden" name="applicationId" value={app.id} />
                      <Button type="submit" className="w-full">
                        確認已入帳並排入出貨
                      </Button>
                    </form>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">LINE 對話時間軸</CardTitle>
            </CardHeader>
            <CardContent>
              {!session || session.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無對話紀錄</p>
              ) : (
                <ol className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
                  {session.messages.map((m) => (
                    <li key={m.id} className="flex gap-3">
                      <time className="w-14 shrink-0 font-mono text-[11px] text-muted-foreground">
                        {formatDateTime(m.sentAt).slice(11, 16) ||
                          formatDateTime(m.sentAt)}
                      </time>
                      <div>
                        <div className="text-[11px] font-medium text-muted-foreground">
                          {m.senderType === 'customer'
                            ? '顧客'
                            : m.senderType === 'bot'
                              ? 'Bot'
                              : m.senderType}
                          {m.lineMessageId ? (
                            <span className="ml-1 font-mono opacity-60">
                              #{m.lineMessageId.slice(-6)}
                            </span>
                          ) : null}
                        </div>
                        <p className="whitespace-pre-wrap">{parseMessageText(m.contentJson)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {app.reviews.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">審核紀錄</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {app.reviews.map((r) => (
                  <div key={r.id} className="rounded-md border px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <Badge variant="muted">{r.decision}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {r.reviewerName || '—'}
                      {r.reasonCode ? ` · ${r.reasonCode}` : ''}
                    </p>
                    {r.note ? <p className="mt-1">{r.note}</p> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'break-all font-mono text-xs' : 'break-words'}>{value}</dd>
    </div>
  );
}
