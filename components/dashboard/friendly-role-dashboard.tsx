'use client';

import Link from 'next/link';
import { Component, type ReactNode, useState } from 'react';
import { Check, ClipboardList, Factory, ImagePlus, Lightbulb, PackageCheck, Store, Truck, Users, X } from 'lucide-react';
import { addTaskAttachment, assignTodayTask, createTodayTask, getTaskDetails, toggleTodayTask, updateTaskDescription, type TaskDetails } from '@/app/(main)/dashboard/task-actions';
import type { TaskAssignee, TodayTaskRow } from '@/lib/dashboard-tasks';

type RoleKey = 'ming' | 'cc' | 'chang-jun' | 'jia-jun' | 'jie-xin';
type RolePlan = { title: string; intro: string; priorities: { title: string; href: string; icon: typeof ClipboardList }[] };
type DashboardKpis = { todayOrderCount: number; lowStockCount: number; merchantsCount: number; activeSubscriptionsCount: number; weekJarRedeemCount: number };
type BoundaryProps = { children: ReactNode };
type BoundaryState = { hasError: boolean };

export class WorkbenchErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };
  static getDerivedStateFromError(): BoundaryState { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <section className="rounded-2xl border border-border/70 bg-card p-6 text-center shadow-card"><h2 className="text-xl font-semibold text-navy">工作台暫時無法顯示</h2><p className="mt-2 text-sm text-muted-foreground">原本的營運頁面沒有受到影響，請先回到營運數據。</p><Link href="/dashboard?view=insights" className="mt-4 inline-flex rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background">回到營運數據</Link></section>;
    return this.props.children;
  }
}

const plans: Record<RoleKey, RolePlan> = {
  ming: { title: 'Ming｜公司負責人', intro: '今天先做一個能讓團隊往前的決定。', priorities: [{ title: '看公司進度與瓶頸', href: '/mission', icon: Factory }, { title: '看通路成長', href: '/merchants', icon: Store }, { title: '看產品進度', href: '/products', icon: Lightbulb }] },
  cc: { title: 'cc｜營運協調', intro: '先把今天會卡住出貨的事情清掉。', priorities: [{ title: '處理訂單與出貨', href: '/orders', icon: ClipboardList }, { title: '確認低庫存', href: '/inventory', icon: PackageCheck }, { title: '看出貨狀態', href: '/shipments?status=pending', icon: Truck }] },
  'chang-jun': { title: '常峻｜通路成長', intro: '先追最有機會產生首購或補貨的店家。', priorities: [{ title: '追蹤店家', href: '/merchants', icon: Store }, { title: '看首購訂單', href: '/orders', icon: PackageCheck }, { title: '看補貨需求', href: '/restock-requests', icon: ClipboardList }] },
  'jia-jun': { title: '佳君｜內容與研究', intro: '先整理一個能幫團隊做決定的洞察。', priorities: [{ title: '整理消費者回饋', href: '/customers', icon: Users }, { title: '看本週任務', href: '/tasks', icon: ClipboardList }, { title: '送往產品的洞察', href: '/products', icon: Lightbulb }] },
  'jie-xin': { title: '潔心｜產品專案', intro: '先把一個洞察變成下一個可測試的動作。', priorities: [{ title: '看產品專案', href: '/products', icon: Lightbulb }, { title: '看來源洞察', href: '/customers', icon: Users }, { title: '看生產與庫存', href: '/inventory', icon: PackageCheck }] },
};

function today(value: string | null) {
  return value ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei' }).format(new Date(value)) === new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei' }).format(new Date()) : false;
}

export function FriendlyRoleDashboard({ initialRole = 'ming', initialTasks = [], assignees = [], kpis = null }: { initialRole?: string; initialTasks?: TodayTaskRow[]; assignees?: TaskAssignee[]; kpis?: DashboardKpis | null }) {
  const role = (initialRole in plans ? initialRole : 'ming') as RoleKey;
  const plan = plans[role];
  const [tasks, setTasks] = useState(initialTasks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [details, setDetails] = useState<TaskDetails | null>(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsText, setDetailsText] = useState('');

  const activeTasks = tasks.filter((task) => task.status !== 'done');
  const archivedTasks = tasks.filter((task) => task.status === 'done' && today(task.completedAt));

  async function openDetails(task: TodayTaskRow) {
    setDetailsBusy(true); setError(null);
    try {
      const result = await getTaskDetails(task.id);
      setDetails(result); setDetailsText(result.description ?? '');
    } catch (e) { setError(e instanceof Error ? e.message : '讀取工作內容失敗'); } finally { setDetailsBusy(false); }
  }

  async function saveDetails() {
    if (!details) return;
    setDetailsBusy(true); setError(null);
    try {
      await updateTaskDescription(details.id, detailsText);
      setDetails({ ...details, description: detailsText.trim() || null });
      setMessage('工作內容已同步到 HQ。');
    } catch (e) { setError(e instanceof Error ? e.message : '儲存工作內容失敗'); } finally { setDetailsBusy(false); }
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !details) return;
    const formData = new FormData(); formData.set('file', file);
    setDetailsBusy(true); setError(null);
    try {
      await addTaskAttachment(details.id, formData);
      const result = await getTaskDetails(details.id);
      setDetails(result); setDetailsText(result.description ?? '');
      setMessage('圖片已加入這筆工作。');
    } catch (e) { setError(e instanceof Error ? e.message : '圖片上傳失敗'); } finally { setDetailsBusy(false); event.target.value = ''; }
  }

  async function complete(task: TodayTaskRow) {
    setBusyId(task.id); setError(null);
    try {
      await toggleTodayTask(task.id, true);
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'done', completedAt: new Date().toISOString() } : item));
      setMessage('已完成，這筆工作仍保留在 HQ 的完成紀錄。');
    } catch (e) { setError(e instanceof Error ? e.message : '更新工作失敗'); } finally { setBusyId(null); }
  }

  async function addTask() {
    const title = draftTitle.trim(); if (!title) return;
    setBusyId('new'); setError(null);
    try {
      const created = await createTodayTask(title);
      setTasks((current) => [...current, created]);
      setDraftTitle(''); setAdding(false); setMessage('已新增到 HQ，共用的工作清單。');
    } catch (e) { setError(e instanceof Error ? e.message : '新增工作失敗'); } finally { setBusyId(null); }
  }

  async function transfer(task: TodayTaskRow, assigneeId: string) {
    setBusyId(task.id); setError(null);
    try {
      await assignTodayTask(task.id, assigneeId || null);
      const assignee = assignees.find((item) => item.id === assigneeId) ?? null;
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, assignee } : item));
      setMessage(assignee ? `已將「${task.title}」轉交給 ${assignee.name}。` : '已取消指派，這筆工作回到共用清單。');
    } catch (e) { setError(e instanceof Error ? e.message : '轉交工作失敗'); } finally { setBusyId(null); }
  }

  const metrics = [['今日訂單', kpis?.todayOrderCount ?? 0, '/orders'], ['低庫存', kpis?.lowStockCount ?? 0, '/inventory'], ['合作店家', kpis?.merchantsCount ?? 0, '/merchants'], ['本週換罐', kpis?.weekJarRedeemCount ?? 0, '/jar-exchange/manage?tab=codes']] as const;

  return <div className="space-y-6">
    {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
    {message ? <div role="status" className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-navy">{message}</div> : null}

    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">工作台</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-navy sm:text-4xl">{plan.title.split('｜')[0]} 的工作台</h1>
        <p className="mt-2 text-base text-muted-foreground">{role === 'ming' ? '今天先處理真正需要你決定的事' : plan.intro}</p>
      </div>
      <button type="button" onClick={() => setAdding((value) => !value)} className="rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background hover:opacity-90">新增工作</button>
    </header>

    {adding ? <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-4 shadow-card sm:flex-row"><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addTask(); }} placeholder="例如：確認本週出貨安排" aria-label="新增工作名稱" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" autoFocus /><button type="button" disabled={busyId === 'new'} onClick={() => void addTask()} className="rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-50">{busyId === 'new' ? '儲存中' : '加入'}</button><button type="button" onClick={() => { setAdding(false); setDraftTitle(''); }} className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground">取消</button></div> : null}

    <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-card sm:p-8">
      <div className="rounded-2xl bg-emerald-50/70 p-5 sm:p-7">
        <p className="text-sm font-semibold text-emerald-800">{role === 'ming' ? '今天最重要的決定' : '今天最重要的工作'}</p>
        {activeTasks[0] ? <><h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-navy sm:text-3xl">{activeTasks[0].title}</h2><p className="mt-3 text-base text-muted-foreground">{role === 'ming' ? '先處理這件事，讓團隊知道下一步。' : plan.intro}</p><button type="button" disabled={detailsBusy} onClick={() => void openDetails(activeTasks[0])} className="mt-5 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50">{detailsBusy ? '讀取中' : role === 'ming' ? '開始處理' : '查看內容'}</button></> : <><h2 className="mt-3 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">目前沒有待處理的優先工作</h2><p className="mt-3 text-base text-muted-foreground">新增一件今天真正重要的工作，讓工作台從這裡開始。</p><button type="button" onClick={() => setAdding(true)} className="mt-5 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background">新增第一件工作</button></>}
      </div>
    </section>

    <section>
      <div className="mb-3"><p className="text-sm font-medium text-muted-foreground">需要你注意</p><h2 className="mt-1 text-xl font-semibold text-navy">只看會影響今天的事</h2></div>
      <div className="grid gap-3 md:grid-cols-3">
        {[['待處理', activeTasks.length], ['已指派', activeTasks.filter((task) => task.assignee).length], ['今日完成', archivedTasks.length]].map(([label, value]) => <div key={label} className="rounded-2xl border border-border/70 bg-card p-5 shadow-card"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold text-navy">{value}</p><p className="mt-1 text-sm text-muted-foreground">筆工作</p></div>)}
      </div>
    </section>

    <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-card sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-muted-foreground">公司進度</p><h2 className="mt-1 text-xl font-semibold text-navy">雞霸第一階段</h2></div><Link href="/mission" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">查看共同進度</Link></div>
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><p className="text-4xl font-semibold text-emerald-800">620 <span className="text-lg font-normal text-muted-foreground">／ 1,000 片</span></p><p className="text-sm text-muted-foreground">本週速度 92 片</p></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-[62%] rounded-full bg-emerald-700" /></div><p className="mt-2 text-right text-sm font-medium text-navy">62%</p>
    </section>

    <section>
      <div className="mb-3"><p className="text-sm font-medium text-muted-foreground">快速查看</p><h2 className="mt-1 text-xl font-semibold text-navy">只看你現在需要的地方</h2></div>
      <div className="grid gap-3 md:grid-cols-3">{plan.priorities.map(({ title, href, icon: CardIcon }) => <Link key={title} href={href} className="flex min-h-20 items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card transition-colors hover:border-foreground/30"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><CardIcon className="h-5 w-5 text-primary" /></span><span className="text-sm font-semibold text-navy">{title}</span></Link>)}</div>
    </section>

    <p className="text-xs text-muted-foreground">工作台只整理今天的優先順序；訂單、店家、產品與庫存仍以原本的 HQ 頁面為準。</p>

    {details ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`工作內容 ${details.title}`}><section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-5 shadow-xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">工作內容</p><h2 className="mt-1 text-xl font-semibold text-navy">{details.title}</h2><p className="mt-1 text-xs text-muted-foreground">{details.assignee ? `負責人：${details.assignee.name}` : '共用工作'}</p></div><button type="button" onClick={() => setDetails(null)} aria-label="關閉工作內容" className="rounded-lg p-2 hover:bg-muted"><X className="h-5 w-5" /></button></div><label className="mt-5 block"><span className="text-sm font-medium text-navy">說明</span><textarea value={detailsText} onChange={(event) => setDetailsText(event.target.value)} rows={5} placeholder="補充背景、完成標準或交接內容" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" /></label><div className="mt-3 flex justify-end"><button type="button" disabled={detailsBusy} onClick={() => void saveDetails()} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">{detailsBusy ? '儲存中' : '儲存說明'}</button></div><div className="mt-6 border-t border-border/70 pt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-navy">圖片</h3><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"><ImagePlus className="h-4 w-4" />上傳圖片<input type="file" accept="image/*" className="sr-only" disabled={detailsBusy} onChange={(event) => void uploadImage(event)} /></label></div><p className="mt-1 text-xs text-muted-foreground">單張圖片最多 50 MB。</p>{details.attachments.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{details.attachments.map((attachment) => <a key={attachment.id} href={attachment.dataUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-border/70 bg-muted/20"><img src={attachment.dataUrl} alt={attachment.fileName} className="h-40 w-full object-cover" /><p className="truncate px-3 py-2 text-xs text-muted-foreground">{attachment.fileName}</p></a>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">尚未上傳圖片</p>}</div></section></div> : null}
  </div>;
}

