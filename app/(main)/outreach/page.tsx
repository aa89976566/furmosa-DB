import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { outreachAdmin } from '@/lib/outreach/admin';
import { sendingEnabled } from '@/lib/outreach/service';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { approveContact, stopContact, checkOutreach } from './actions';

export const dynamic = 'force-dynamic';
const labels: Record<string, string> = {APPROVED: '待寄出', WAITING: '等待回覆', REPLIED: '已回覆',
  DO_NOT_CONTACT: '不再聯絡', BLOCKED: '需要人工核對', COMPLETE: '已完成'};
const notices: Record<string, string> = {saved: '已記錄。重複品牌會保留原紀錄，不會重新寄信。',
  invalid: '資料未儲存，請確認官方來源、收件地址及所有必填欄位。',
  checked: '信箱與待處理資料檢查完成，本次沒有寄信。', 'check-failed': '信箱或資料庫檢查失敗，請稍後再試。'};

export default async function OutreachPage({searchParams}: {searchParams: {notice?: string}}) {
  if (!await outreachAdmin()) notFound();
  const rows = await prisma.outreachContact.findMany({orderBy: {updatedAt: 'desc'}, take: 100,
    include: {messages: {orderBy: {sequence: 'asc'}, select: {id: true, sequence: true, status: true, sentAt: true}}}});
  return <>
    <PageHeader title="品牌接洽" description="以 support@furmosa.com 聯絡已核准的品牌；五個工作天後最多追信一次。" />
    <div className="space-y-5 p-4 md:p-6">
      <Card><CardContent className="space-y-3 p-4">
        <p>{sendingEnabled() ? '公司信箱自動寄送已開啟' : '自動寄送尚未開啟'} · 每日最多 5 封初次開發信</p>
        <p className="text-sm text-muted-foreground">收到回覆即停止追信。寄送結果不明時會保留紀錄並等待核對，不會自動重寄。</p>
        <form action={checkOutreach}><Button variant="outline" size="sm">檢查信箱連線（不寄信）</Button></form>
        {searchParams.notice && <p role="status">{notices[searchParams.notice] || ''}</p>}
      </CardContent></Card>
      <details className="rounded-lg border bg-card p-4"><summary className="cursor-pointer font-medium">新增已核准的品牌</summary>
        <form action={approveContact} className="mt-4 grid gap-3 md:grid-cols-2">
          {([['brand', '品牌名稱', 'text', 120], ['domain', '官方網域', 'text', 253],
            ['email', '商務聯絡信箱', 'email', 254], ['sourceUrl', '公開聯絡方式的官方頁面', 'url', 2000],
            ['product', '接洽產品', 'text', 500], ['reason', '已判定值得接洽的理由', 'text', 2000],
            ['subject', '英文信件主旨', 'text', 160]] as const).map(([name, label, type, maxLength]) =>
              <label key={name} className="space-y-1 text-sm">{label}<Input name={name} type={type} maxLength={maxLength} required /></label>)}
          <label className="space-y-1 text-sm md:col-span-2">英文開發信內容<textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" name="body" rows={10} maxLength={12000} required /></label>
          <label className="flex items-start gap-2 text-sm md:col-span-2"><input name="verified" type="checkbox" required />
            已確認此品牌值得接洽、地址來自官方公開頁面且適合商務聯繫；信件未虛構銷量或合作規模。</label>
          <Button type="submit" className="w-fit">加入寄送名單</Button>
        </form>
      </details>
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.length === 0 && <p className="text-muted-foreground">目前沒有已核准的品牌。尚未寄出任何開發信。</p>}
        {rows.map(row => <Card key={row.id}><CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{row.brand}</h2><span className="text-sm">{labels[row.status] || '待核對'}</span></div>
          <p className="break-all text-sm">{row.email}</p><p className="text-sm">{row.product}</p>
          <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">官方聯絡來源</a>
          {row.firstSentAt && <p className="text-sm">初次寄出：{row.firstSentAt.toLocaleString('zh-TW', {timeZone: 'Europe/Madrid'})}</p>}
          {row.status === 'WAITING' && row.followUpDueAt && !row.followUpSentAt && <p className="text-sm">可追信時間：{row.followUpDueAt.toLocaleString('zh-TW', {timeZone: 'Europe/Madrid'})}（Madrid）</p>}
          {row.followUpSentAt && <p className="text-sm">已追信一次，不會再追第二次。</p>}
          {row.status === 'BLOCKED' && <p className="text-sm">請核對既有往來或寄送結果，再決定下一步。</p>}
          {row.replySummary && <p className="whitespace-pre-wrap break-words text-sm">{row.replySummary}</p>}
          {row.status === 'REPLIED' && !row.replySummary && <p className="text-sm">已停止追信，回覆重點整理中。</p>}
          <details><summary className="cursor-pointer text-sm">查看原開發信</summary><p className="my-2 text-sm font-medium">{row.subject}</p><p className="whitespace-pre-wrap break-words text-sm">{row.body}</p></details>
          {!row.doNotContact && <form action={stopContact}><input type="hidden" name="id" value={row.id} /><Button size="sm" variant="outline">停止聯絡此品牌</Button></form>}
        </CardContent></Card>)}
      </div>
    </div>
  </>;
}
