/**
 * Phase 4B-C daily morning plan runner
 * production-shaped、結構上完全不具發送能力：
 * - 禁止 import sender／LINE push adapter／reply
 * - 輸出僅 typed plan／ledger／preview metadata
 */

import {
  pickApprovedAnimalFact,
} from '@/lib/line/morning/animal-fact';
import { pickApprovedJoke } from '@/lib/line/morning/content';
import {
  decideMorningContent,
  type MorningDecision,
} from '@/lib/line/morning/domain/decision';
import { toDomainContentMode } from '@/lib/line/morning/domain/consent';
import { defaultMockNewsProvider } from '@/lib/line/morning/news/mock-feed';
import {
  pickAutoApprovedNews,
  processCandidates,
  type MorningNewsProvider,
} from '@/lib/line/morning/news/provider';
import {
  evaluateMorningPlanEligibility,
} from '@/lib/line/morning/plan/eligibility';
import { findLastSuccessMorningContentType } from '@/lib/line/morning/plan/alternate-history';
import {
  findPlanLedger,
  insertPlanLedgerIdempotent,
  listPlanLedgersForRunDate,
} from '@/lib/line/morning/plan/ledger';
import {
  MORNING_PLAN_REASONS,
  type MorningPlanLedgerRow,
  type MorningPlanReason,
} from '@/lib/line/morning/plan/types';
import {
  getMorningPreference,
  type MorningPreferenceRow,
} from '@/lib/line/morning/preferences';
import { morningTaipeiDate } from '@/lib/line/morning/schedule';
import {
  defaultTransactionalProvider,
  TRANSACTIONAL_COVERAGE_NOTES,
  type TransactionalSignalProvider,
} from '@/lib/line/morning/transactional';
import { prisma } from '@/lib/prisma';
import { parseTaipeiDateRange } from '@/lib/taipei-date';

export type PlanOneInput = {
  lineUserId: string;
  preference?: MorningPreferenceRow | null;
  hasConfirmSuccess?: boolean;
  /** Asia/Taipei YYYY-MM-DD；缺省由 now 推導 */
  runDate?: string;
  now?: Date;
  transactional?: TransactionalSignalProvider;
  newsProvider?: MorningNewsProvider;
  petSpecies?: string | null;
};

export type PlanOneResult = {
  runDate: string;
  lineUserId: string;
  planStatus: 'PLANNED' | 'SKIPPED';
  decisionReason: MorningPlanReason | string;
  contentType: string | null;
  contentId: string | null;
  ledger: MorningPlanLedgerRow;
  created: boolean;
  /** Preview 用：不寫入 ledger */
  previewText?: string | null;
  transactionalHits?: Array<{ channel: string; at: Date }>;
};

function mapPetTag(
  species: string | null | undefined,
): Array<'dog' | 'cat' | 'rabbit' | 'bird' | 'rodent'> {
  if (!species) return [];
  if (species === 'dog') return ['dog'];
  if (species === 'cat') return ['cat'];
  if (species === 'rabbit') return ['rabbit'];
  if (species === 'bird_reptile') return ['bird'];
  if (species === 'small_mammal') return ['rodent'];
  return [];
}

/** runDate → 用於星期判斷的瞬間（當日正午 +08） */
export function runDateToInstant(runDate: string): Date {
  const range = parseTaipeiDateRange(runDate, runDate);
  if (!range) {
    throw new Error(`invalid Asia/Taipei runDate: ${runDate}`);
  }
  // 正午避免邊界歧義
  return new Date(`${runDate}T12:00:00+08:00`);
}

export function resolvePlanRunDate(now: Date = new Date()): string {
  // 強制 Asia/Taipei 曆日；禁止 toISOString 切日
  return morningTaipeiDate(now);
}

async function hasConfirmLedgerSuccess(lineUserId: string): Promise<boolean> {
  const row = await prisma.lineMorningPreferenceConfirmLedger.findFirst({
    where: { lineUserId, status: 'SUCCESS' },
    select: { id: true },
  });
  return Boolean(row);
}

function decisionToPlanReason(d: MorningDecision): MorningPlanReason {
  if (d.outcome === 'DELIVER') return MORNING_PLAN_REASONS.PLANNED;
  if (d.reason === 'no_safe_news') return MORNING_PLAN_REASONS.NO_SAFE_NEWS;
  if (d.reason === 'not_opted_in') return MORNING_PLAN_REASONS.NOT_OPTED_IN;
  return MORNING_PLAN_REASONS.NO_CONTENT;
}

/**
 * 為單一會員產生今日 plan（冪等寫入 ledger）
 * 壞資料隔離：呼叫端應 catch；本函式對缺 preference 回 typed skip。
 */
export async function planOneMemberDay(
  input: PlanOneInput,
): Promise<PlanOneResult> {
  const now = input.now ?? new Date();
  const runDate = input.runDate ?? resolvePlanRunDate(now);
  const runInstant = runDateToInstant(runDate);
  const transactional = input.transactional ?? defaultTransactionalProvider;
  const newsProvider = input.newsProvider ?? defaultMockNewsProvider;

  // 已有 ledger → 冪等回讀（0 additional semantic writes beyond read）
  const existing = await findPlanLedger(runDate, input.lineUserId);
  if (existing) {
    return {
      runDate,
      lineUserId: input.lineUserId,
      planStatus: existing.planStatus,
      decisionReason: existing.decisionReason,
      contentType: existing.contentType,
      contentId: existing.contentId,
      ledger: existing,
      created: false,
    };
  }

  let preference = input.preference;
  if (preference === undefined) {
    preference = await getMorningPreference(input.lineUserId);
  }

  const hasConfirmSuccess =
    input.hasConfirmSuccess ??
    (await hasConfirmLedgerSuccess(input.lineUserId));

  const elig = evaluateMorningPlanEligibility({
    preference,
    hasConfirmSuccess,
    runInstant,
  });

  if (!elig.eligible) {
    const { row, created } = await insertPlanLedgerIdempotent({
      lineUserId: input.lineUserId,
      runDate,
      planStatus: 'SKIPPED',
      decisionReason: elig.reason,
      contentId: null,
      contentType: null,
    });
    return {
      runDate,
      lineUserId: input.lineUserId,
      planStatus: 'SKIPPED',
      decisionReason: elig.reason,
      contentType: null,
      contentId: null,
      ledger: row,
      created,
    };
  }

  const pref = preference!;

  // 交易通知優先（同一 Asia/Taipei 曆日 00:00–23:59:59.999）
  const txHits = await transactional.findSignalsForMorning(
    input.lineUserId,
    runDate,
    runInstant,
  );
  if (txHits.length > 0) {
    const { row, created } = await insertPlanLedgerIdempotent({
      lineUserId: input.lineUserId,
      runDate,
      planStatus: 'SKIPPED',
      decisionReason: MORNING_PLAN_REASONS.TRANSACTIONAL_PRIORITY,
    });
    return {
      runDate,
      lineUserId: input.lineUserId,
      planStatus: 'SKIPPED',
      decisionReason: MORNING_PLAN_REASONS.TRANSACTIONAL_PRIORITY,
      contentType: null,
      contentId: null,
      ledger: row,
      created,
      transactionalHits: txHits.map((h) => ({ channel: h.channel, at: h.at })),
    };
  }

  const processed = processCandidates(
    await newsProvider.fetchCandidates(runInstant),
    runInstant,
  );
  const news = pickAutoApprovedNews(processed);
  const joke = await pickApprovedJoke({
    preferredTags: mapPetTag(input.petSpecies),
    now: runInstant,
  });
  const animalFact = await pickApprovedAnimalFact({ now: runInstant });

  const domainMode = toDomainContentMode(pref.contentMode);
  const lastSuccess =
    domainMode === 'ALTERNATE'
      ? await findLastSuccessMorningContentType(input.lineUserId)
      : null;

  const decision = decideMorningContent({
    contentMode: pref.contentMode,
    taipeiDate: runDate,
    lastSuccessContentType: lastSuccess,
    availability: {
      hasSafeNews: Boolean(news),
      hasHumor: Boolean(joke),
      hasAnimalFact: Boolean(animalFact),
    },
  });

  if (decision.outcome === 'SKIP') {
    const reason = decisionToPlanReason(decision);
    const { row, created } = await insertPlanLedgerIdempotent({
      lineUserId: input.lineUserId,
      runDate,
      planStatus: 'SKIPPED',
      decisionReason: reason,
    });
    return {
      runDate,
      lineUserId: input.lineUserId,
      planStatus: 'SKIPPED',
      decisionReason: reason,
      contentType: null,
      contentId: null,
      ledger: row,
      created,
    };
  }

  let contentId: string | null = null;
  let previewText: string | null = null;
  if (decision.contentType === 'HUMOR' && joke) {
    contentId = joke.id;
    previewText = joke.body;
  } else if (decision.contentType === 'NEWS' && news) {
    // MorningNewsRecord 尚未 persist 時以 fingerprint 當穩定 contentId
    contentId = news.fingerprint;
    previewText = news.title;
  } else if (decision.contentType === 'ANIMAL_FACT' && animalFact) {
    contentId = animalFact.id;
    previewText = animalFact.factSummary;
  } else {
    const { row, created } = await insertPlanLedgerIdempotent({
      lineUserId: input.lineUserId,
      runDate,
      planStatus: 'SKIPPED',
      decisionReason: MORNING_PLAN_REASONS.NO_CONTENT,
    });
    return {
      runDate,
      lineUserId: input.lineUserId,
      planStatus: 'SKIPPED',
      decisionReason: MORNING_PLAN_REASONS.NO_CONTENT,
      contentType: null,
      contentId: null,
      ledger: row,
      created,
    };
  }

  const { row, created } = await insertPlanLedgerIdempotent({
    lineUserId: input.lineUserId,
    runDate,
    planStatus: 'PLANNED',
    decisionReason: MORNING_PLAN_REASONS.PLANNED,
    contentId,
    contentType: decision.contentType,
  });

  return {
    runDate,
    lineUserId: input.lineUserId,
    planStatus: row.planStatus === 'PLANNED' ? 'PLANNED' : 'SKIPPED',
    decisionReason: row.decisionReason,
    contentType: row.contentType,
    contentId: row.contentId,
    ledger: row,
    created,
    previewText: created ? previewText : null,
  };
}

export type DailyPlanRunSummary = {
  runDate: string;
  plannedCount: number;
  skippedCount: number;
  results: PlanOneResult[];
  transactionalCoverageNotes: readonly string[];
  errors: Array<{ lineUserId: string; error: string }>;
};

/**
 * 批次：每位會員獨立 try/catch（壞資料隔離）
 */
export async function runDailyMorningPlan(opts?: {
  now?: Date;
  runDate?: string;
  lineUserIds?: string[];
  limit?: number;
  transactional?: TransactionalSignalProvider;
  newsProvider?: MorningNewsProvider;
}): Promise<DailyPlanRunSummary> {
  const now = opts?.now ?? new Date();
  const runDate = opts?.runDate ?? resolvePlanRunDate(now);
  const limit = opts?.limit ?? 500;

  const prefWhere = opts?.lineUserIds?.length
    ? { lineUserId: { in: opts.lineUserIds } }
    : {};

  const prefs = await prisma.lineMorningPreference.findMany({
    where: prefWhere,
    take: limit,
  });

  const lineIds = prefs.map((p) => p.lineUserId);
  const customers = lineIds.length
    ? await prisma.customer.findMany({
        where: { lineUserId: { in: lineIds } },
        select: { lineUserId: true, petSpecies: true },
      })
    : [];
  const petByLine = new Map(
    customers.map((c) => [c.lineUserId!, c.petSpecies ?? null]),
  );

  const confirmRows = lineIds.length
    ? await prisma.lineMorningPreferenceConfirmLedger.findMany({
        where: { lineUserId: { in: lineIds }, status: 'SUCCESS' },
        select: { lineUserId: true },
        distinct: ['lineUserId'],
      })
    : [];
  const confirmed = new Set(confirmRows.map((r) => r.lineUserId));

  const results: PlanOneResult[] = [];
  const errors: Array<{ lineUserId: string; error: string }> = [];

  for (const p of prefs) {
    try {
      const preference: MorningPreferenceRow = {
        id: p.id,
        lineUserId: p.lineUserId,
        customerId: p.customerId,
        contentMode: p.contentMode as MorningPreferenceRow['contentMode'],
        frequency: p.frequency as MorningPreferenceRow['frequency'],
        pausedAt: p.pausedAt,
        promptedAt: p.promptedAt,
      };
      const result = await planOneMemberDay({
        lineUserId: p.lineUserId,
        preference,
        hasConfirmSuccess: confirmed.has(p.lineUserId),
        runDate,
        now,
        transactional: opts?.transactional,
        newsProvider: opts?.newsProvider,
        petSpecies: petByLine.get(p.lineUserId) ?? null,
      });
      results.push(result);
    } catch (err) {
      errors.push({
        lineUserId: p.lineUserId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    runDate,
    plannedCount: results.filter((r) => r.planStatus === 'PLANNED').length,
    skippedCount: results.filter((r) => r.planStatus === 'SKIPPED').length,
    results,
    transactionalCoverageNotes: TRANSACTIONAL_COVERAGE_NOTES,
    errors,
  };
}

export async function loadTodayPlanSummary(runDate: string) {
  const rows = await listPlanLedgersForRunDate(runDate);
  return {
    runDate,
    plannedCount: rows.filter((r) => r.planStatus === 'PLANNED').length,
    skippedCount: rows.filter((r) => r.planStatus === 'SKIPPED').length,
    rows,
    transactionalCoverageNotes: TRANSACTIONAL_COVERAGE_NOTES,
  };
}
