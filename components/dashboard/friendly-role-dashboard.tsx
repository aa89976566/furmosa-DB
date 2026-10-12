'use client';

import Link from 'next/link';
import { Component, type ReactNode } from 'react';
import { useState } from 'react';
import { Check, ClipboardList, Factory, Lightbulb, PackageCheck, Store, Truck, Users } from 'lucide-react';
import { createTodayTask, assignTodayTask, toggleTodayTask } from '@/app/(main)/dashboard/task-actions';
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
    if (this.state.hasError) {
      return <section className="rounded-2xl border border-border/70 bg-card p-6 text-center shadow-card"><h2 className="text-xl font-semibold text-navy">工作台暫時無法顯示</h2><p className="mt-2 text-sm text-muted-foreground">原本的營運頁面沒有受到影響，請先回到營運數據。</p><Link href="/dashboard?view=insights" className="mt-4 inline-flex rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background">回到營運數據</Link></section>;
    }
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
  const activeTasks = tasks.filter((task) => task.status !== 'done');
  const archivedTasks = tasks.filter((task) => task.status === 'done' && today(task.completedAt));
  const visibleTasks = activeTasks.slice(0, 5);

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

  const metrics = [
    ['今日訂單', kpis?.todayOrderCount ?? 0, '/orders'],
    ['低庫存', kpis?.lowStockCount ?? 0, '/inventory'],
    ['合作店家', kpis?.merchantsCount ?? 0, '/merchants'],
    ['本週換罐', kpis?.weekJarRedeemCount ?? 0, '/jar-exchange/manage?tab=codes'],
  ] as const;

  return <div className="space-y-5">
    {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
    {message ? <div role="status" className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-navy">{message}</div> : null}
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-muted-foreground">共同方向</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-navy">雞霸第一階段：每月 1,000 片</h2></div><Link href="/mission" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">查看共同進度</Link></div>
      <div className="mt-5 flex items-end justify-between"><div><p className="text-3xl font-semibold text-navy">620 <span className="text-base font-normal text-muted-foreground">／ 1,000 片</span></p><p className="mt-1 text-sm text-muted-foreground">本週速度 92 片・目前卡點：首批穩定供貨</p></div><div className="text-right text-sm font-medium text-navy">62%</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-[62%] rounded-full bg-foreground" /></div>
    </section>
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-muted-foreground">今天先做</p><h2 className="mt-1 text-xl font-semibold text-navy">{plan.title}</h2><p className="mt-2 text-sm text-muted-foreground">{plan.intro}</p></div><button type="button" onClick={() => setAdding((value) => !value)} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">新增工作</button></div>
      {adding ? <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 sm:flex-row"><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addTask(); }} placeholder="例如：確認本週出貨安排" aria-label="新增工作名稱" className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" autoFocus /><button type="button" disabled={busyId === 'new'} onClick={() => void addTask()} className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50">{busyId === 'new' ? '儲存中' : '加入'}</button><button type="button" onClick={() => { setAdding(false); setDraftTitle(''); }} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground">取消</button></div> : null}
      <div className="mt-5 space-y-2">{visibleTasks.length ? visibleTasks.map((task) => <div key={task.id} className="flex flex-col gap-3 rounded-xl border border-border/70 p-3 sm:flex-row sm:items-center"><input type="checkbox" disabled={busyId === task.id} aria-label={`完成 ${task.title}`} onChange={() => void complete(task)} className="h-4 w-4 accent-foreground" /><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><ClipboardList className="h-4 w-4" /></div><p className="min-w-0 flex-1 text-sm font-medium text-navy">{task.title}</p><label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><span>轉交給</span><select aria-label={`轉交 ${task.title}`} disabled={busyId === task.id} value={task.assignee?.id ?? ''} onChange={(event) => void transfer(task, event.target.value)} className="max-w-36 rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground"><option value="">共用工作</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}</select></label></div>) : <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">今天沒有待處理的優先工作</p>}{activeTasks.length > 5 ? <p className="text-center text-xs text-muted-foreground">還有 {activeTasks.length - 5} 筆，請到任務頁查看全部</p> : null}</div>
      {archivedTasks.length ? <section className="mt-5 rounded-xl border border-border/70 bg-muted/30 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-navy">今日完成</p><p className="mt-1 text-xs text-muted-foreground">共 {archivedTasks.length} 筆，已保留在 HQ</p></div><Link href="/tasks#column-done" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted">查看全部</Link></div></section> : null}
    </section>
    <section><div className="mb-3 flex items-end justify-between"><div><p className="text-sm font-medium text-muted-foreground">直接進入</p><h2 className="mt-1 text-xl font-semibold text-navy">只看你現在需要的地方</h2></div></div><div className="grid gap-3 md:grid-cols-3">{plan.priorities.map(({ title, href, icon: CardIcon }) => <Link key={title} href={href} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-foreground/30"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><CardIcon className="h-4 w-4 text-primary" /></span><span className="text-sm font-semibold text-navy">{title}</span></Link>)}</div></section>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([label, value, href]) => <Link key={label} href={href} className="rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-foreground/30"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold text-navy">{value}</p></Link>)}</section>
    <p className="text-xs text-muted-foreground">工作台只整理今天的優先順序；訂單、店家、產品與庫存仍以原本的 HQ 頁面為準。</p>
  </div>;
}
