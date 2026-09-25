import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { prisma } from '@/lib/prisma';

export async function RecoverySummary() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recovering, recovered, manual] = await Promise.all([
    prisma.automationJob.count({
      where: { status: { in: ['pending', 'retrying', 'processing'] } },
    }),
    prisma.automationJob.count({
      where: {
        status: { in: ['completed', 'fallback_succeeded'] },
        completedAt: { gte: since },
      },
    }),
    prisma.automationJob.count({ where: { status: 'manual_required' } }),
  ]);

  return <section className="rounded-2xl border border-border/70 bg-card p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold text-navy">系統自動修復</h2>
        <p className="mt-1 text-sm text-muted-foreground">多數暫時性問題會在背景自行恢復。</p>
      </div>
      <RefreshCw className="h-5 w-5 text-primary" />
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Status label="正在修復" value={recovering} icon={<RefreshCw className="h-4 w-4" />} />
      <Status label="24 小時內已恢復" value={recovered} icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
      <Status label="需要人工確認" value={manual} icon={<AlertTriangle className="h-4 w-4 text-warning" />} />
    </div>
  </section>;
}

function Status({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="rounded-xl bg-muted/50 p-3">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
    <p className="mt-2 text-2xl font-semibold text-navy">{value}</p>
  </div>;
}
