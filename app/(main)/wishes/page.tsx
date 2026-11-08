import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { canReviewWishes, readWish, wishStatusLabels } from '@/lib/guide/wishes';
import { reviewWish } from './actions';

export const dynamic = 'force-dynamic';
export default async function WishesPage() {
  const user = await getCurrentUser();
  if (!canReviewWishes(user?.role)) return <p className="p-6">請使用具有許願審核權限的 HQ 帳號登入。</p>;
  const tasks = await prisma.task.findMany({ where: { type: 'customer_service', reference: { startsWith: 'FMWISH:' } },
    orderBy: { createdAt: 'desc' }, take: 200 });
  return <>
    <PageHeader title="許願池" description="查看物種、需求與 LINE ID，確認後由匠寵聯繫。" />
    <div className="space-y-4 p-4 sm:p-6">
      <Link href="/tasks" className="text-sm underline">返回任務</Link>
      <p className="text-sm text-muted-foreground">顯示最新 200 筆；新許願預設為待審核。</p>
      {!tasks.length && <p className="rounded-xl border bg-card p-8 text-center">目前沒有許願。</p>}
      {tasks.map(task => {
        const wish = readWish(task.description);
        if (!wish) return <article key={task.id} className="rounded-xl border bg-card p-5">這筆許願資料格式不完整，請由管理員核對。</article>;
        return <article key={task.id} className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">{wish.species}</h2><Badge variant="muted">{wishStatusLabels[task.status] ?? task.status}</Badge></div>
          <dl className="grid gap-4 sm:grid-cols-[100px_1fr]">
            <dt className="text-muted-foreground">需求</dt><dd className="whitespace-pre-wrap break-words">{wish.requestText}</dd>
            <dt className="text-muted-foreground">LINE ID</dt><dd className="select-all break-all font-mono">{wish.lineId}</dd>
            <dt className="text-muted-foreground">送出時間</dt><dd>{task.createdAt.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}</dd>
          </dl>
          <form action={reviewWish} className="flex flex-wrap gap-3 border-t pt-4">
            <input type="hidden" name="taskId" value={task.taskId} />
            <label className="sr-only" htmlFor={task.id}>審核狀態</label>
            <select id={task.id} name="status" defaultValue={task.status} className="rounded-lg border bg-background px-3 py-2">
              {Object.entries(wishStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">儲存狀態</button>
          </form>
        </article>;
      })}
    </div>
  </>;
}
