import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { SectionBlock } from '@/components/shared/section-block';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OMS_LABELS, parseOmsIssues } from '@/lib/orders/oms';
import { omsProblemsWhere, taiwanToday } from '@/lib/orders/oms-workbench';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { formatCurrency } from '@/lib/format';

export async function OmsDashboard() {
  const [today, review, issues, pending, needsAttention] = await Promise.all([
    prisma.order.count({ where: { deletedAt: null, omsStatus: { not: null }, orderedAt: taiwanToday() } }),
    prisma.order.count({ where: { deletedAt: null, omsStatus: { in: ['NEW', 'REVIEW'] } } }),
    prisma.order.count({ where: omsProblemsWhere }),
    prisma.order.count({ where: { deletedAt: null, omsStatus: 'FULFILLMENT_PENDING' } }),
    prisma.order.findMany({ where: { deletedAt: null, OR: [{ omsStatus: { in: ['NEW', 'REVIEW', 'READY'] } }, omsProblemsWhere] },
      orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }], take: 10,
      select: { id: true, orderNumber: true, externalOrderName: true, total: true, omsStatus: true, omsIssueFlags: true, shopifySnapshot: true } }),
  ]);
  const cards = [
    { label: '今日新訂單', value: today, href: '/orders?day=today', hint: '台灣時間今日下單，含已處理' },
    { label: '待審核', value: review, href: '/orders?queue=review', hint: '新訂單＋待審核' },
    { label: '有問題', value: issues, href: '/orders?oms=issues', hint: '需處理、提醒或尚未檢查' },
    { label: '待出貨', value: pending, href: '/orders?oms=FULFILLMENT_PENDING', hint: '已建立 HQ 內部出貨單' },
  ];
  return <SectionBlock tone="orders" title="今天的訂單工作" description="先處理異常，再確認訂單。數字可能重疊，不代表不同訂單。">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(card => <Link key={card.label} href={card.href} className="rounded-lg focus-visible:outline focus-visible:outline-2">
        <Card><CardContent className="p-4"><p className="text-sm">{card.label}</p><p className="text-2xl font-semibold">{card.value}</p><p className="text-xs text-muted-foreground">{card.hint}</p></CardContent></Card>
      </Link>)}
    </div>
    <div className="space-y-2">
      <h3 className="font-medium">需要你處理</h3>
      <p className="text-xs text-muted-foreground">最早的 10 筆待處理訂單；點擊訂單查看詳情。</p>
      {needsAttention.length === 0 && <p className="rounded-lg border p-4 text-sm">目前沒有待審核、可建立出貨單或異常的 OMS 訂單。</p>}
      {needsAttention.map(order => {
        const flags = parseOmsIssues(order.omsIssueFlags);
        const issue = flags?.find(i => i.severity === 'blocking') ?? flags?.[0];
        return <Link key={order.id} href={`/orders/${order.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
          <div className="min-w-0"><p className="text-sm font-medium">{order.externalOrderName || order.orderNumber} · {snapshotView(order.shopifySnapshot)?.recipient || '收件人待確認'}</p>
            <p className={`break-words text-xs ${issue?.severity === 'blocking' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {issue?.message ?? (order.omsStatus === 'READY' ? '已確認，可建立 HQ 出貨單' : '請進入訂單檢查資料')}
            </p></div>
          <span className="text-sm">{order.omsStatus ? OMS_LABELS[order.omsStatus] : ''} · {formatCurrency(order.total)}</span>
        </Link>;
      })}
      <Button variant="outline" size="sm" asChild><Link href="/orders">查看所有訂單</Link></Button>
    </div>
  </SectionBlock>;
}
