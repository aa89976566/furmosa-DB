import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/shared/status-badge';
import { taskStatusLabel, taskTypeLabel } from '@/lib/labels';
import { formatDate } from '@/lib/format';
import { Plus, CalendarClock } from 'lucide-react';

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

  return (
    <>
      <PageHeader
        title="任務看板 Task Ops"
        description="跨部門待辦：庫存、結算、客服、廠商、行銷"
        actions={
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            新增任務
          </Button>
        }
      />
      <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => {
          const list = grouped.get(col.key) ?? [];
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{col.label}</h2>
                  <Badge variant="muted">{list.length}</Badge>
                </div>
              </div>
              <div className="space-y-2">
                {list.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-6 text-center text-xs text-muted-foreground">
                      無任務
                    </CardContent>
                  </Card>
                ) : (
                  list.map((t) => (
                    <Card key={t.id}>
                      <CardContent className="space-y-2 p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {t.taskId}
                          </span>
                          <StatusBadge kind="taskPriority" value={t.priority} />
                        </div>
                        <p className="text-sm font-medium leading-snug">{t.title}</p>
                        {t.description ? (
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                        ) : null}
                        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                          <Badge variant="secondary">{taskTypeLabel[t.type]}</Badge>
                          {t.dueDate ? (
                            <span className="flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" />
                              {formatDate(t.dueDate, 'M/d')}
                            </span>
                          ) : null}
                        </div>
                        {t.assignee ? (
                          <div className="flex items-center gap-2 border-t pt-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px]">
                                {t.assignee.name.slice(0, 1)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {t.assignee.name}
                            </span>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
