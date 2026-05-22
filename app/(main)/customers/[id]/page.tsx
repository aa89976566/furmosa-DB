import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { customerTypeLabel, pointSourceLabel } from '@/lib/labels';
import { parseTags } from '@/lib/parse-tags';
import { ArrowLeft, Crown, Repeat, MessageCircle, AtSign } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      orders: {
        orderBy: { orderedAt: 'desc' },
        take: 30,
      },
      subscriptions: {
        include: {
          plan: true,
          shipments: {
            orderBy: { scheduledDate: 'asc' },
          },
        },
        orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      },
      pointLedger: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      redemptions: {
        include: { reward: true, payoutMerchant: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!customer) notFound();

  const tags = parseTags(customer.tags);
  const activeSub = customer.subscriptions.find((s) => s.status === 'active');

  return (
    <>
      <PageHeader
        title={customer.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{customer.customerId}</span>
            {customer.isLoyaltyMember && (
              <Badge variant="warning" className="gap-1">
                <Crown className="h-3 w-3" /> 換罐會員
                {customer.loyaltyMemberId && (
                  <span className="ml-1 font-mono text-[10px] opacity-80">
                    {customer.loyaltyMemberId}
                  </span>
                )}
              </Badge>
            )}
            {activeSub && (
              <Badge variant="info" className="gap-1">
                <Repeat className="h-3 w-3" /> 訂閱中 · {activeSub.plan.name}
              </Badge>
            )}
          </span>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/customers">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        {/* 基本資料 */}
        <SectionCard title="基本資料" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <Row label="編號" value={<span className="font-mono">{customer.customerId}</span>} />
            <Row label="類型" value={<Badge variant="secondary">{customerTypeLabel[customer.type]}</Badge>} />
            <Row label="電話" value={customer.phone ?? '-'} />
            <Row label="Email" value={customer.email ?? '-'} />
            <Row label="生日" value={customer.birthday ? formatDate(customer.birthday) : '-'} />
            <Row label="地址" value={customer.address ?? '-'} />
            <Row
              label="標籤"
              value={
                tags.length ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    {tags.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  '-'
                )
              }
            />
          </dl>
        </SectionCard>

        {/* 聯絡 / 社群 */}
        <SectionCard title="聯絡 & 社群" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <Row
              label={
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" /> LINE
                </span>
              }
              value={
                customer.lineUserId ? (
                  <div className="text-right">
                    <div className="font-medium">{customer.lineDisplay ?? '-'}</div>
                    <div className="font-mono text-xs text-muted-foreground">{customer.lineUserId}</div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">未綁定</span>
                )
              }
            />
            <Row
              label={
                <span className="flex items-center gap-1">
                  <AtSign className="h-3 w-3" /> Instagram
                </span>
              }
              value={customer.socialIg ?? <span className="text-muted-foreground">-</span>}
            />
            <Row label="Facebook" value={customer.socialFb ?? <span className="text-muted-foreground">-</span>} />
            <Row
              label="收件地址"
              value={
                <div className="text-right text-sm">
                  {customer.address ?? <span className="text-muted-foreground">未填寫</span>}
                </div>
              }
            />
            <Row
              label="預設運輸方式"
              value={
                customer.preferredShippingMethod === 'convenience' ? (
                  <div className="text-right">
                    <Badge variant="secondary">超商取貨</Badge>
                    {(customer.preferredCvsBrand ||
                      customer.preferredCvsStoreName ||
                      customer.preferredCvsStoreId) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {customer.preferredCvsBrand === '711'
                          ? '7-ELEVEN'
                          : customer.preferredCvsBrand === 'familymart'
                            ? '全家'
                            : customer.preferredCvsBrand === 'hilife'
                              ? '萊爾富'
                              : (customer.preferredCvsBrand ?? '')}{' '}
                        {customer.preferredCvsStoreName ?? ''}
                        {customer.preferredCvsStoreId
                          ? `（店號 ${customer.preferredCvsStoreId}）`
                          : ''}
                      </div>
                    )}
                  </div>
                ) : customer.preferredShippingMethod === 'home' ? (
                  <Badge variant="outline">宅配</Badge>
                ) : (
                  <span className="text-muted-foreground">未設定</span>
                )
              }
            />
          </dl>
        </SectionCard>

        {/* 銷售與會員概覽 */}
        <SectionCard title="會員與銷售概覽" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="累計消費" value={formatCurrency(Number(customer.totalSpent))} />
            <Stat label="訂單數" value={formatNumber(customer.orders.length)} />
            <Stat
              label="可用點數"
              value={customer.isLoyaltyMember ? formatNumber(customer.loyaltyPoints) : '-'}
              note={customer.isLoyaltyMember ? '換罐會員' : '非換罐會員'}
            />
            <Stat
              label="會員等級"
              value={
                customer.loyaltyTier ? (
                  <StatusBadge kind="loyaltyTier" value={customer.loyaltyTier} />
                ) : (
                  '-'
                )
              }
            />
          </div>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {customer.isLoyaltyMember ? (
              <>
                <p>累計入點：{formatNumber(customer.loyaltyEarned)}</p>
                <p>累計兌換：{formatNumber(customer.loyaltyRedeemed)}</p>
                {customer.joinedLoyaltyAt && <p>加入會員：{formatDate(customer.joinedLoyaltyAt)}</p>}
              </>
            ) : (
              <p>還不是換罐會員，可在官網輸入序號加入</p>
            )}
          </div>
        </SectionCard>

        {/* 訂閱合約 */}
        {customer.subscriptions.length > 0 && (
          <SectionCard
            title="訂閱合約"
            description="包含進行中、暫停、到期、已取消的全部合約"
            className="lg:col-span-3"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/subscriptions">所有訂閱</Link>
              </Button>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>合約編號</TableHead>
                  <TableHead>方案</TableHead>
                  <TableHead>付款方式</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>開始</TableHead>
                  <TableHead>到期</TableHead>
                  <TableHead>下次出貨</TableHead>
                  <TableHead className="text-right">已出 / 預定</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.subscriptions.map((s) => {
                  const total = s.shipments.length;
                  const shipped = s.shipments.filter(
                    (sh) => sh.status === 'shipped' || sh.status === 'delivered',
                  ).length;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          href={`/subscriptions/${s.id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {s.subscriptionNo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{s.plan.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(Number(s.plan.monthlyPrice))} / 月
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="subscriptionCycle" value={s.billingCycle} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="subscription" value={s.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(s.startDate)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.endDate ? formatDate(s.endDate) : <span className="text-muted-foreground">無限</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.nextShipmentDate && s.status === 'active' ? (
                          formatDate(s.nextShipmentDate)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {shipped} / {total}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </SectionCard>
        )}

        {/* 訂單史 */}
        <SectionCard title="訂單史" className="lg:col-span-2">
          {customer.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無訂單</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>訂單編號</TableHead>
                  <TableHead>來源</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">總額</TableHead>
                  <TableHead>時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/orders/${o.id}`} className="font-mono text-xs hover:underline">
                        {o.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="orderSource" value={o.source} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="order" value={o.status} />
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(o.total))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(o.orderedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        {/* 點數帳本 */}
        <SectionCard
          title="點數帳本"
          description="只顯示最近 20 筆"
          className="lg:col-span-1"
        >
          {!customer.isLoyaltyMember ? (
            <p className="text-sm text-muted-foreground">尚未加入換罐會員</p>
          ) : customer.pointLedger.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無點數紀錄</p>
          ) : (
            <div className="space-y-2 text-sm">
              {customer.pointLedger.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <StatusBadge kind="point" value={p.type} />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {pointSourceLabel[p.source]} · {formatDateTime(p.createdAt)}
                    </div>
                  </div>
                  <div
                    className={`text-right text-base font-semibold ${p.points >= 0 ? 'text-success' : 'text-info'}`}
                  >
                    {p.points > 0 ? '+' : ''}
                    {p.points}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* 兌換紀錄 */}
        {customer.redemptions.length > 0 && (
          <SectionCard title="兌換紀錄" className="lg:col-span-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>編號</TableHead>
                  <TableHead>贈品</TableHead>
                  <TableHead className="text-right">使用點數</TableHead>
                  <TableHead>履約店家</TableHead>
                  <TableHead className="text-right">公司應付</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.redemptionId}</TableCell>
                    <TableCell className="font-medium">{r.reward.name}</TableCell>
                    <TableCell className="text-right">{r.pointsUsed}</TableCell>
                    <TableCell className="text-sm">
                      {r.payoutMerchant ? (
                        <Link
                          href={`/merchants/${r.payoutMerchant.id}`}
                          className="text-info hover:underline"
                        >
                          {r.payoutMerchant.name}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(r.payoutAmount))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="redemption" value={r.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {note && <div className="text-[11px] text-muted-foreground">{note}</div>}
    </div>
  );
}
