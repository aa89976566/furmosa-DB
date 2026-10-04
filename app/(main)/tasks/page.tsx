import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { taskStatusLabel, taskTypeLabel } from '@/lib/labels';
import { formatDate } from '@/lib/format';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 建置時不預抓 DB，避免 Vercel SSG 因資料庫短暫不可達而整包部署失敗 */
export const dynamic = 'force-dynamic';

type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

const columns: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: taskStatusLabel.todo },
  { key: 'in_progress', label: taskStatusLabel.in_progress },
  { key: 'blocked', label: taskStatusLabel.blocked },
  { key: 'done', label: taskStatusLabel.done },
];

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default async function TasksPage() {
  const tasksRaw = await prisma.task.findMany({
    include: { assignee: true },
    orderBy: { dueDate: 'asc' },
  });
  const tasks = [...tasksRaw].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
  );

  const grouped = new Map<TaskStatus, typeof tasks>();
  for (const c of columns) grouped.set(c.key, []);
  for (const t of tasks) {
    grouped.get(t.status as TaskStatus)?.push(t);
  }

  const now = new Date();

  return (
    <>
      <PageHeader
        title="任務"
        description="依工作階段、優先級與期限追蹤跨部門待辦。"
      />
      <main className="p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => {
            const list = grouped.get(col.key) ?? [];

            return (
              <section
                key={col.key}
                id={col.key === 'done' ? 'column-done' : undefined}
                aria-label={`${col.label}任務`}
                className={cn(
                  'overflow-hidden rounded-xl border border-border/70 bg-card',
                  col.key === 'done' && 'scroll-mt-24 bg-muted/10',
                )}
              >
                <header className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3">
                  <h2 className="text-sm font-semibold">{col.label}</h2>
                  <Badge variant="muted" className="tabular-nums">
                    {list.length}
                  </Badge>
                </header>

                {list.length === 0 ? (
                  <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                    目前沒有任務
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {list.map((t) => {
                      const overdue = Boolean(
                        t.dueDate && t.dueDate < now && t.status !== 'done',
                      );

                      return (
                        <article key={t.id} className="space-y-3 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium leading-snug">{t.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="font-mono">{t.taskId}</span>
                                <span aria-hidden>·</span>
                                <span>{taskTypeLabel[t.type]}</span>
                              </div>
                            </div>
                            <StatusBadge kind="taskPriority" value={t.priority} />
                          </div>

                          {t.description ? (
                            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {t.description}
                            </p>
                          ) : null}

                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <div
                              className={cn(
                                'flex items-center gap-1',
                                overdue && 'font-medium text-destructive',
                              )}
                            >
                              {t.dueDate ? (
                                <>
                                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                                  <span>
                                    {overdue ? '逾期 ' : ''}
                                    {formatDate(t.dueDate, 'M/d')}
                                  </span>
                                </>
                              ) : (
                                <span>未設定期限</span>
                              )}
                            </div>

                            {t.assignee ? (
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
                                  {t.assignee.name.slice(0, 1)}
                                </span>
                                <span className="max-w-28 truncate">{t.assignee.name}</span>
                              </div>
                            ) : (
                              <span>未指派</span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
