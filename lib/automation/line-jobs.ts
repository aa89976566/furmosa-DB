import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  notifyRefillCompleted,
  notifyRefillPaid,
} from '@/lib/refill/notify';
import {
  AUTOMATION_JOB_TYPES,
  type RefillCompletedPayload,
  type RefillPaidPayload,
} from './job-types';
import {
  decideRecovery,
  normalizeAutomationError,
} from './recovery-policy';

const LOCK_MS = 60_000;

export async function enqueueRefillPaidNotification(refillOrderId: string) {
  return prisma.automationJob.upsert({
    where: { jobKey: `line:refill-paid:${refillOrderId}` },
    update: {},
    create: {
      jobKey: `line:refill-paid:${refillOrderId}`,
      type: AUTOMATION_JOB_TYPES.refillPaidLine,
      entityType: 'refill_order',
      entityId: refillOrderId,
      payload: { refillOrderId } satisfies RefillPaidPayload,
    },
  });
}

export async function enqueueRefillCompletedNotification(
  refillOrderId: string,
  pointsAwarded: boolean,
) {
  return prisma.automationJob.upsert({
    where: { jobKey: `line:refill-completed:${refillOrderId}` },
    update: {},
    create: {
      jobKey: `line:refill-completed:${refillOrderId}`,
      type: AUTOMATION_JOB_TYPES.refillCompletedLine,
      entityType: 'refill_order',
      entityId: refillOrderId,
      payload: {
        refillOrderId,
        pointsAwarded,
      } satisfies RefillCompletedPayload,
    },
  });
}

async function deliver(type: string, payload: Prisma.JsonValue) {
  const data = payload as Record<string, unknown>;
  const refillOrderId = String(data.refillOrderId ?? '');
  if (!refillOrderId) throw new Error('自動作業缺少 refillOrderId');

  if (type === AUTOMATION_JOB_TYPES.refillPaidLine) {
    await notifyRefillPaid(refillOrderId);
    return;
  }
  if (type === AUTOMATION_JOB_TYPES.refillCompletedLine) {
    await notifyRefillCompleted(refillOrderId, Boolean(data.pointsAwarded));
    return;
  }
  throw new Error(`不支援的自動作業：${type}`);
}

async function applyFallback(jobId: string, error: string) {
  // 通知是附加效果；主要交易、點數與庫存已完成。安全替代方案只保留紀錄，
  // 客戶仍可從既有 LIFF 頁面查看狀態，絕不重做主要交易。
  await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: 'fallback_succeeded',
      lastError: error,
      fallbackResult: 'LINE 未送達；主要交易已保留，客戶可由既有 LINE 會員頁查看最新狀態。',
      lockedUntil: null,
      completedAt: new Date(),
    },
  });
}

export async function processAutomationJob(jobId: string) {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCK_MS);
  const claimed = await prisma.automationJob.updateMany({
    where: {
      id: jobId,
      OR: [
        {
          status: { in: ['pending', 'retrying'] },
          nextAttemptAt: { lte: now },
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
        },
        { status: 'processing', lockedUntil: { lt: now } },
      ],
    },
    data: { status: 'processing', lockedUntil: lockUntil },
  });
  if (claimed.count !== 1) return { status: 'skipped' as const };

  const job = await prisma.automationJob.findUniqueOrThrow({ where: { id: jobId } });
  try {
    await deliver(job.type, job.payload);
    await prisma.automationJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        attempts: { increment: 1 },
        lastError: null,
        lockedUntil: null,
        completedAt: new Date(),
      },
    });
    return { status: 'completed' as const };
  } catch (cause) {
    const error = normalizeAutomationError(cause);
    const attempts = job.attempts + 1;
    const decision = decideRecovery(attempts, false, now);
    if (decision.action === 'retry') {
      await prisma.automationJob.update({
        where: { id: job.id },
        data: {
          status: 'retrying',
          attempts,
          nextAttemptAt: decision.nextAttemptAt,
          lockedUntil: null,
          lastError: error,
        },
      });
      return { status: 'retrying' as const };
    }
    await applyFallback(job.id, error);
    return { status: 'fallback_succeeded' as const };
  }
}

export async function processDueAutomationJobs(limit = 20) {
  const jobs = await prisma.automationJob.findMany({
    where: {
      OR: [
        {
          status: { in: ['pending', 'retrying'] },
          nextAttemptAt: { lte: new Date() },
        },
        { status: 'processing', lockedUntil: { lt: new Date() } },
      ],
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: Math.max(1, Math.min(limit, 50)),
    select: { id: true },
  });
  const results = [];
  for (const job of jobs) results.push(await processAutomationJob(job.id));
  return {
    examined: jobs.length,
    completed: results.filter((item) => item.status === 'completed').length,
    retrying: results.filter((item) => item.status === 'retrying').length,
    fallbackSucceeded: results.filter((item) => item.status === 'fallback_succeeded').length,
  };
}

export async function safelyEnqueueAndAttempt(
  enqueue: () => Promise<{ id: string; status: string }>,
) {
  try {
    const job = await enqueue();
    if (job.status === 'pending' || job.status === 'retrying') {
      await processAutomationJob(job.id);
    }
  } catch (error) {
    // 自動修復機制自身故障也不可讓已完成的主要交易回滾。
    console.error('[automation] enqueue/attempt', normalizeAutomationError(error));
  }
}
