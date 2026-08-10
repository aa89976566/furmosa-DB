/**
 * HQ 只讀 plan Preview（與 daily-runner／decision／transactional 同契約）
 * - 既有 HQ auth 下使用；不寫 preference；不真送
 * - LINE id 永遠遮罩
 */

import { renderJokeMessage, renderNewsMessage, renderAnimalFactMessage } from '@/lib/line/morning/renderer';
import { prisma } from '@/lib/prisma';
import {
  loadTodayPlanSummary,
  maskLineUserId,
  resolvePlanRunDate,
  runDailyMorningPlan,
} from '@/lib/line/morning/plan';
import { TRANSACTIONAL_COVERAGE_NOTES } from '@/lib/line/morning/transactional';

export { TRANSACTIONAL_COVERAGE_NOTES as PLAN_TRANSACTIONAL_COVERAGE_NOTES };

export type MorningPlanPreviewRow = {
  maskedLineUserId: string;
  planStatus: string;
  decisionReason: string;
  contentType: string | null;
  contentPreview: string | null;
};

export type MorningPlanPreviewResult = {
  runDate: string;
  plannedCount: number;
  skippedCount: number;
  rows: MorningPlanPreviewRow[];
  transactionalCoverageNotes: readonly string[];
  notes: string[];
};

async function loadContentPreview(
  contentType: string | null,
  contentId: string | null,
): Promise<string | null> {
  if (!contentType || !contentId) return null;
  if (contentType === 'HUMOR') {
    const row = await prisma.lineMorningContent.findUnique({
      where: { id: contentId },
      select: { body: true },
    });
    if (!row) return null;
    return renderJokeMessage({ body: row.body }).text;
  }
  if (contentType === 'NEWS') {
    const row = await prisma.lineMorningNewsItem.findUnique({
      where: { id: contentId },
      select: {
        factSummary: true,
        barkLine: true,
        canonicalUrl: true,
        sourceName: true,
        publishedAt: true,
      },
    });
    if (!row) return null;
    return renderNewsMessage({
      factSummary: row.factSummary,
      barkLine: row.barkLine,
      canonicalUrl: row.canonicalUrl,
      sourceName: row.sourceName,
      publishedAt: row.publishedAt,
    }).text;
  }
  if (contentType === 'ANIMAL_FACT') {
    const row = await prisma.lineMorningAnimalFact.findUnique({
      where: { id: contentId },
      select: {
        factSummary: true,
        barkLine: true,
        attribution: true,
        canonicalUrl: true,
        sourcePublishedAt: true,
      },
    });
    if (!row) return null;
    return renderAnimalFactMessage({
      factSummary: row.factSummary,
      barkLine: row.barkLine,
      attribution: row.attribution,
      canonicalUrl: row.canonicalUrl,
      sourcePublishedAt: row.sourcePublishedAt,
    }).text;
  }
  return null;
}
/**
 * 只讀：載入既有今日 plan；可選 generate=true 時跑結構零發送 runner（寫 plan ledger，不送 LINE）
 */
export async function buildMorningPlanPreview(opts?: {
  now?: Date;
  runDate?: string;
  /** 若尚無 ledger，是否執行 plan runner（仍 0 push） */
  generateIfEmpty?: boolean;
  limit?: number;
}): Promise<MorningPlanPreviewResult> {
  const now = opts?.now ?? new Date();
  const runDate = opts?.runDate ?? resolvePlanRunDate(now);
  const notes = [
    '結構零發送：不 import sender；不真送 LINE。',
    'LINE user id 已遮罩。',
    '未覆蓋：換罐／開箱／出貨 pending（見交易覆蓋說明）。',
  ];

  let summary = await loadTodayPlanSummary(runDate);
  if (summary.rows.length === 0 && opts?.generateIfEmpty) {
    await runDailyMorningPlan({
      now,
      runDate,
      limit: opts.limit ?? 50,
    });
    summary = await loadTodayPlanSummary(runDate);
  }

  const rows: MorningPlanPreviewRow[] = [];
  for (const r of summary.rows.slice(0, opts?.limit ?? 50)) {
    const contentPreview = await loadContentPreview(r.contentType, r.contentId);
    rows.push({
      maskedLineUserId: maskLineUserId(r.lineUserId),
      planStatus: r.planStatus,
      decisionReason: r.decisionReason,
      contentType: r.contentType,
      contentPreview,
    });
  }

  return {
    runDate: summary.runDate,
    plannedCount: summary.plannedCount,
    skippedCount: summary.skippedCount,
    rows,
    transactionalCoverageNotes: TRANSACTIONAL_COVERAGE_NOTES,
    notes,
  };
}
