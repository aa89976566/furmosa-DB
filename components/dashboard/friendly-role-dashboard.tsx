'use client';

import Link from 'next/link';
import { Component, type ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Check, CircleDot, ClipboardList, Factory, Lightbulb, PackageCheck, Store, Truck, Users } from 'lucide-react';
import type { TodayTaskRow } from '@/lib/dashboard-tasks';

type RoleKey = 'ming' | 'cc' | 'chang-jun' | 'jia-jun' | 'jie-xin';
type RolePlan = { title: string; intro: string; priorities: { title: string; href: string; icon: typeof ClipboardList }[] };
type DashboardKpis = { todayOrderCount: number; lowStockCount: number; merchantsCount: number; activeSubscriptionsCount: number; weekJarRedeemCount: number };
const STORAGE_VERSION = 'v1';

type BoundaryProps = { children: ReactNode };
type BoundaryState = { hasError: boolean };

export class WorkbenchErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <section className="rounded-2xl border border-border/70 bg-card p-6 text-center shadow-card"><h2 className="text-xl font-semibold text-navy">預覽暫時無法顯示</h2><p className="mt-2 text-sm text-muted-foreground">正式營運首頁沒有受到影響，請先回到原本的工作台。</p><Link href="/dashboard" className="mt-4 inline-flex rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background">回到營運首頁</Link></section>;
    }
    return this.props.children;
  }
}

const plans: Record<RoleKey, RolePlan> = {
  ming: { title: 'Ming｜公司負責人', intro: '今天只先做一個能讓團隊往前的決定。', priorities: [{ title: '看公司進度與瓶頸', href: '/mission', icon: Factory }, { title: '看通路成長', href: '/merchants', icon: Store }, { title: '看產品進度', href: '/products', icon: Lightbulb }] },
  cc: { title: 'cc｜營運協調', intro: '先把今天會卡住出貨的事情清掉。', priorities: [{ title: '處理訂單與出貨', href: '/orders', icon: ClipboardList }, { title: '確認低庫存', href: '/inventory', icon: PackageCheck }, { title: '看出貨狀態', href: '/shipments?status=pending', icon: Truck }] },
  'chang-jun': { title: '常峻｜通路成長', intro: '先追最有機會產生首購或補貨的店家。', priorities: [{ title: '追蹤店家', href: '/merchants', icon: Store }, { title: '看首購訂單', href: '/orders', icon: PackageCheck }, { title: '看補貨需求', href: '/restock-requests', icon: ClipboardList }] },
  'jia-jun': { title: '佳君｜內容與研究', intro: '先整理一個能幫團隊做決定的洞察。', priorities: [{ title: '整理消費者回饋', href: '/customers', icon: Users }, { title: '看本週任務', href: '/tasks', icon: ClipboardList }, { title: '送往產品的洞察', href: '/products', icon: Lightbulb }] },
  'jie-xin': { title: '潔心｜產品專案', intro: '先把一個洞察變成下一個可測試的動作。', priorities: [{ title: '看產品專案', href: '/products', icon: Lightbulb }, { title: '看來源洞察', href: '/customers', icon: Users }, { title: '看生產與庫存', href: '/inventory', icon: PackageCheck }] },
};

export function FriendlyRoleDashboard({ initialRole = 'ming', initialTasks = [], kpis = null }: { initialRole?: string; initialTasks?: TodayTaskRow[]; kpis?: DashboardKpis | null }) {
  const role = (initialRole in plans ? initialRole : 'ming') as RoleKey;
  const plan = plans[role];
  const [tasks, setTasks] = useState(initialTasks);
  const [editing, setEditing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [achieved, setAchieved] = useState<{ id: string; time: string }[]>([]);
  const [showAchieved, setShowAchieved] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState<{ message: string; restoreId?: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const activeTasks = tasks.filter((task) => !achieved.some((item) => item.id === task.id));
  const visibleTasks = showAll ? activeTasks : activeTasks.slice(0, 5);
  const archivedTasks = achieved.map((item) => ({ item, task: tasks.find((task) => task.id === item.id) })).filter((entry): entry is { item: { id: string; time: string }; task: TodayTaskRow } => Boolean(entry.task));
  const todayTaipei = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
  const archiveKey = `hq-workbench-achieved-${STORAGE_VERSION}-${role}`;
  const localTasksKey = `hq-workbench-local-${STORAGE_VERSION}-${role}`;
  useEffect(() => {
    const storageKey = `hq-workbench-order-${STORAGE_VERSION}-${role}`;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(storageKey);
    } catch {
      return;
    }
    if (!saved) return;
    try {
      const order = JSON.parse(saved) as string[];
      setTasks((current) => {
        const ordered = order.map((id) => current.find((task) => task.id === id)).filter((task): task is TodayTaskRow => Boolean(task));
        return [...ordered, ...current.filter((task) => !order.includes(task.id))];
      });
    } catch {
      try { window.localStorage.removeItem(storageKey); } catch { /* 瀏覽器儲存空間不可用時使用預設順序 */ }
    }
  }, [role]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(archiveKey);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      const valid = Array.isArray(parsed) ? parsed.filter((item): item is { id: string; time: string } => Boolean(item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' && typeof (item as { time?: unknown }).time === 'string' && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date((item as { time: string }).time)) === todayTaipei)) : [];
      let localTaskIds = new Set<string>();
      try {
        const local = JSON.parse(window.localStorage.getItem(localTasksKey) ?? '[]') as Array<{ id?: unknown }>;
        localTaskIds = new Set(local.filter((item) => typeof item?.id === 'string').map((item) => item.id as string));
      } catch {
        // 只使用正式任務清單。
      }
      setAchieved(valid.filter((item) => initialTasks.some((task) => task.id === item.id) || localTaskIds.has(item.id)));
    } catch {
      setAchieved([]);
    }
  }, [archiveKey, initialTasks, localTasksKey]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(localTasksKey);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      const localTasks = Array.isArray(parsed) ? parsed.filter((item): item is TodayTaskRow => Boolean(item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' && typeof (item as { title?: unknown }).title === 'string')).map((item) => ({ ...item, taskId: item.taskId || item.id, status: item.status || 'OPEN', completedAt: null })) : [];
      setTasks((current) => [...current.filter((task) => !localTasks.some((item) => item.id === task.id)), ...localTasks]);
    } catch {
      // 本機儲存空間不可用時仍使用正式 HQ 任務。
    }
  }, [localTasksKey]);
  const move = (index: number, direction: -1 | 1) => {
    const next = [...activeTasks];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const activeIds = new Set(activeTasks.map((task) => task.id));
    setTasks([...next, ...tasks.filter((task) => !activeIds.has(task.id))]);
    try { window.localStorage.setItem(`hq-workbench-order-${STORAGE_VERSION}-${role}`, JSON.stringify(next.map((task) => task.id))); } catch { /* 不影響今日工作台使用 */ }
  };
  const complete = (task: TodayTaskRow) => {
    const next = [...achieved, { id: task.id, time: new Date().toISOString() }];
    setAchieved(next);
    try { window.localStorage.setItem(archiveKey, JSON.stringify(next)); } catch { /* 預覽資料無法保存時仍可完成當次操作 */ }
    setNotice({ message: `已標記「${task.title}」`, restoreId: task.id });
  };
  const restore = (id: string) => {
    const next = achieved.filter((item) => item.id !== id);
    setAchieved(next);
    try { window.localStorage.setItem(archiveKey, JSON.stringify(next)); } catch { /* 預覽資料無法保存時仍可恢復 */ }
    setNotice({ message: '已復原，工作回到今天的清單' });
  };
  const addLocalTask = () => {
    const title = draftTitle.trim();
    if (!title) return;
    const id = `local-${role}-${Date.now()}`;
    const task: TodayTaskRow = { id, taskId: id, title, status: 'OPEN', completedAt: null };
    const next = [...tasks, task];
    setTasks(next);
    setDraftTitle('');
    setAdding(false);
    try {
      const existing = JSON.parse(window.localStorage.getItem(localTasksKey) ?? '[]') as TodayTaskRow[];
      window.localStorage.setItem(localTasksKey, JSON.stringify([...existing, task]));
    } catch {
      // 本機儲存空間不可用時仍保留本次畫面上的新增工作。
    }
    setNotice({ message: '已新增到今天的工作清單' });
  };
  const drop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const next = [...activeTasks];
    const from = next.findIndex((task) => task.id === draggedId);
    const to = next.findIndex((task) => task.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const activeIds = new Set(activeTasks.map((task) => task.id));
    setTasks([...next, ...tasks.filter((task) => !activeIds.has(task.id))]);
    try { window.localStorage.setItem(`hq-workbench-order-${STORAGE_VERSION}-${role}`, JSON.stringify(next.map((task) => task.id))); } catch { /* 不影響今日工作台使用 */ }
  };
  const metrics = [
    ['今日訂單', kpis?.todayOrderCount ?? 0, '/orders'],
    ['低庫存', kpis?.lowStockCount ?? 0, '/inventory'],
    ['合作店家', kpis?.merchantsCount ?? 0, '/merchants'],
    ['本週換罐', kpis?.weekJarRedeemCount ?? 0, '/jar-exchange/manage?tab=codes'],
  ] as const;
  return <div className="space-y-5">
    {notice ? <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-navy shadow-card"><span>{notice.message}</span>{notice.restoreId ? <button type="button" onClick={() => restore(notice.restoreId as string)} className="font-semibold underline underline-offset-4">復原</button> : <button type="button" onClick={() => setNotice(null)} className="text-muted-foreground">知道了</button>}</div> : null}
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card sm:p-6">
      <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">預覽版：排序與標記只存在這台裝置，不會改動 HQ 任務。</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-muted-foreground">共同方向</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-navy">雞霸第一階段：每月 1,000 片</h2></div><Link href="/mission" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">查看共同進度</Link></div>
      <div className="mt-5 flex items-end justify-between"><div><p className="text-3xl font-semibold text-navy">620 <span className="text-base font-normal text-muted-foreground">／ 1,000 片</span></p><p className="mt-1 text-sm text-muted-foreground">本週速度 92 片・目前卡點：首批穩定供貨</p></div><div className="text-right text-sm font-medium text-navy">62%</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-[62%] rounded-full bg-foreground" /></div>
    </section>
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-muted-foreground">今天先做</p><h2 className="mt-1 text-xl font-semibold text-navy">{plan.title}</h2><p className="mt-2 text-sm text-muted-foreground">{plan.intro}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => setAdding((value) => !value)} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">新增工作</button><button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">{editing ? '完成調整' : '調整順序'}</button></div></div>
      {adding ? <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 sm:flex-row"><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addLocalTask(); }} placeholder="例如：確認本週出貨安排" aria-label="新增工作名稱" className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" autoFocus /><button type="button" onClick={addLocalTask} className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background">加入</button><button type="button" onClick={() => { setAdding(false); setDraftTitle(''); }} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground">取消</button></div> : null}
      <div className="mt-5 space-y-2">{visibleTasks.length ? visibleTasks.map((task, index) => <div key={task.id} onDragOver={(event) => { if (editing) event.preventDefault(); }} onDrop={() => drop(task.id)} className="flex items-center gap-3 rounded-xl border border-border/70 p-3"><span draggable={editing} onDragStart={() => setDraggedId(task.id)} aria-label="拖曳排序" title={editing ? '拖曳以調整順序' : undefined} className={`select-none text-muted-foreground ${editing ? 'cursor-grab' : ''}`}>拖曳</span><input type="checkbox" aria-label={`標記完成 ${task.title}`} onChange={() => complete(task)} className="h-4 w-4 accent-foreground" /><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><CircleDot className="h-4 w-4" /></div><p className="min-w-0 flex-1 text-sm font-medium text-navy">{task.title}</p>{editing ? <div className="flex shrink-0 gap-1"><button type="button" aria-label="往前移" disabled={index === 0} onClick={() => move(index, -1)} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40">上移</button><button type="button" aria-label="往後移" disabled={index === visibleTasks.length - 1} onClick={() => move(index, 1)} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40">下移</button></div> : null}</div>) : <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">今天沒有待處理的優先工作</p>}{activeTasks.length > 5 ? <button type="button" onClick={() => setShowAll((value) => !value)} className="w-full rounded-lg py-2 text-sm font-medium text-foreground hover:bg-muted">{showAll ? '收起其他工作' : `查看其餘 ${activeTasks.length - 5} 項`}</button> : null}</div>
      {achieved.length ? <section className="mt-5 rounded-xl border border-border/70 bg-muted/30 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-navy">今日已標記</p><p className="mt-1 text-xs text-muted-foreground">共 {archivedTasks.length} 筆，只存在這台裝置</p></div><button type="button" onClick={() => setShowAchieved((value) => !value)} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted">{showAchieved ? '收起紀錄' : '查看完整紀錄'}</button></div>{showAchieved ? <div className="mt-3 max-h-52 space-y-2 overflow-auto">{archivedTasks.slice().reverse().map(({ item, task }) => <label key={`${item.id}-${item.time}`} className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 text-sm"><input type="checkbox" checked readOnly aria-label={`移回今日 ${task.title}`} onClick={() => restore(item.id)} className="h-4 w-4 accent-foreground" /><span className="min-w-0 flex-1 text-navy line-through opacity-70">{task.title}</span><span className="text-xs text-muted-foreground">{new Date(item.time).toLocaleString('zh-TW', { hour12: false })}</span></label>)}</div> : null}</section> : null}
    </section>
    <section><div className="mb-3 flex items-end justify-between"><div><p className="text-sm font-medium text-muted-foreground">直接進入</p><h2 className="mt-1 text-xl font-semibold text-navy">只看你現在需要的地方</h2></div></div><div className="grid gap-3 md:grid-cols-3">{plan.priorities.map(({ title, href, icon: CardIcon }) => <Link key={title} href={href} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-foreground/30"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><CardIcon className="h-4 w-4 text-primary" /></span><span className="text-sm font-semibold text-navy">{title}</span></Link>)}</div></section>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([label, value, href]) => <Link key={label} href={href} className="rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-foreground/30"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold text-navy">{value}</p></Link>)}</section>
    <p className="text-xs text-muted-foreground">首頁只整理今天的優先順序；訂單、店家、產品與庫存仍以原本的 HQ 頁面為準。</p>
  </div>;
}
