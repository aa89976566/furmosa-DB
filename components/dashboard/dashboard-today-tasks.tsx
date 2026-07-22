'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createTodayTask,
  deleteTodayTask,
  toggleTodayTask,
} from '@/app/(main)/dashboard/task-actions';
import type { TodayTaskRow } from '@/lib/dashboard-tasks';
import { Check, ListTodo, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DashboardTodayTasks({ tasks }: { tasks: TodayTaskRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(tasks);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = items.filter((t) => t.status !== 'done');
  const done = items.filter((t) => t.status === 'done');

  async function handleAdd(e?: React.FormEvent) {
    e?.preventDefault();
    const title = draft.trim();
    if (!title || saving) return;

    setSaving(true);
    setError(null);
    try {
      const created = await createTodayTask(title);
      setItems((prev) => {
        if (prev.some((t) => t.id === created.id)) return prev;
        return [...prev, created];
      });
      setDraft('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(task: TodayTaskRow, checked: boolean) {
    const snapshot = items;
    setItems((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: checked ? 'done' : 'todo',
              completedAt: checked ? new Date() : null,
            }
          : t,
      ),
    );
    setSaving(true);
    setError(null);
    try {
      await toggleTodayTask(task.id, checked);
      router.refresh();
    } catch (e) {
      setItems(snapshot);
      setError(e instanceof Error ? e.message : '更新失敗');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(task: TodayTaskRow) {
    if (!confirm(`刪除「${task.title}」？`)) return;
    const snapshot = items;
    setItems((prev) => prev.filter((t) => t.id !== task.id));
    setSaving(true);
    setError(null);
    try {
      await deleteTodayTask(task.id);
      router.refresh();
    } catch (err) {
      setItems(snapshot);
      setError(err instanceof Error ? err.message : '刪除失敗');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-md border border-border/70 bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ListTodo className="h-4 w-4 text-primary" />
            今日任務
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            勾選完成、新增備忘，團隊共用
          </p>
        </div>
        <Link
          href="/tasks"
          title="開啟完整任務看板（待辦、進行中、已完成等）"
          className="relative z-20 inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background px-3 text-xs font-medium text-foreground transition-linear hover:border-primary/40 hover:bg-muted/60"
        >
          任務看板
        </Link>
      </div>

      <form onSubmit={handleAdd} className="mb-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleAdd();
            }
          }}
          placeholder="新增今日待辦…"
          maxLength={200}
          disabled={saving}
          className="h-9 flex-1 rounded-xl text-sm"
        />
        <Button
          type="submit"
          size="sm"
          disabled={saving || !draft.trim()}
          aria-label="新增任務"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </form>

      {error ? (
        <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="min-h-[8rem] flex-1 space-y-1 overflow-y-auto">
        {active.length === 0 && done.length === 0 ? (
          <li className="py-6 text-center text-sm text-muted-foreground">
            尚無任務，上方輸入後按 + 或 Enter 新增
          </li>
        ) : null}
        {active.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={onToggle}
            onRemove={onRemove}
            disabled={saving}
          />
        ))}
        {done.length > 0 ? (
          <li className="pt-2">
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                已完成
              </p>
              <Link
                href="/tasks#column-done"
                className="text-[10px] text-info hover:underline"
              >
                在看板查看 →
              </Link>
            </div>
            <ul className="space-y-1">
              {done.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={onToggle}
                  onRemove={onRemove}
                  disabled={saving}
                />
              ))}
            </ul>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onRemove,
  disabled,
}: {
  task: TodayTaskRow;
  onToggle: (task: TodayTaskRow, done: boolean) => void;
  onRemove: (task: TodayTaskRow) => void;
  disabled: boolean;
}) {
  const isDone = task.status === 'done';

  return (
    <li
      className={cn(
        'group flex items-start gap-2 rounded-lg border border-transparent px-1 py-1.5 hover:border-border/60 hover:bg-muted/30',
        isDone && 'opacity-70',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        disabled={disabled}
        onClick={() => void onToggle(task, !isDone)}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          isDone
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background hover:border-primary/50',
        )}
      >
        {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm leading-snug',
            isDone && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">{task.taskId}</p>
      </div>
      <button
        type="button"
        onClick={() => void onRemove(task)}
        disabled={disabled}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="刪除任務"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
