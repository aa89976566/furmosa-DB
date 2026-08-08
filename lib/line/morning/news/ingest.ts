/**
 * Fixture → normalize → gate → preview DB（idempotent）
 * 禁止 LINE API；禁止對 enabled=false 來源做真實網路抓取。
 *
 * Identity：contentHash 或 canonicalUrl（同 identity 不新增重複）。
 * 重跑可校正：region／sourceId／sourceName／fetchedAt／gate 中繼。
 * 保留 audit-safe：既有 title／fingerprint／contentHash（已有值時不改）。
 */

import { prisma } from '@/lib/prisma';
import { getMorningSettings } from '@/lib/line/morning/settings';
import { gateNormalizedNews, isMorningNewsCandidate } from '@/lib/line/morning/news/gate';
import {
  normalizeNewsCandidate,
  type NormalizedNewsCandidate,
} from '@/lib/line/morning/news/normalize';
import {
  buildFixtureNewsRaw,
  type FixtureNewsRaw,
} from '@/lib/line/morning/news/mock-feed';
import { renderNewsInStyle, assertNoInventedFacts } from '@/lib/line/morning/style';
import type { GateResult } from '@/lib/line/morning/news/gate';
import { Prisma } from '@prisma/client';

export type IngestStats = {
  fetchedCount: number;
  passedCount: number;
  blockedCount: number;
  duplicateCount: number;
  staleCount: number;
  reviewCount: number;
  reasonCounts: Record<string, number>;
  updatedCount: number;
  passedPreview: Array<{
    contentHash: string;
    title: string;
    sourceName: string;
    region: string;
    renderedText: string;
  }>;
  message: string;
};

export type MorningNewsPersistRow = {
  id: string;
  fingerprint: string;
  contentHash: string | null;
  canonicalUrl: string;
  title: string;
  region: string;
  status: string;
  sourceId: string | null;
  sourceName: string;
};

export type MorningNewsPersistDb = {
  lineMorningNewsItem: {
    findFirst: (args: {
      where: {
        OR: Array<
          | { contentHash: string }
          | { canonicalUrl: string }
          | { fingerprint: string }
        >;
      };
      select: {
        id: true;
        fingerprint: true;
        contentHash: true;
        canonicalUrl: true;
        title: true;
        region: true;
        status: true;
        sourceId: true;
        sourceName: true;
      };
    }) => Promise<MorningNewsPersistRow | null>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<MorningNewsPersistRow>;
    create: (args: { data: Record<string, unknown> }) => Promise<MorningNewsPersistRow>;
    count?: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
  lineMorningIngestRun?: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

/** 可校正欄位；不覆寫既有 title／fingerprint／已存在的 contentHash */
export function buildNewsCorrectableUpdate(input: {
  existing: MorningNewsPersistRow;
  normalized: NormalizedNewsCandidate;
  gate: GateResult;
  observation: string | null;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {
    region: input.gate.region,
    sourceId: input.normalized.sourceId,
    sourceName: input.normalized.sourceName,
    fetchedAt: input.normalized.fetchedAt,
    riskLevel: input.gate.riskLevel,
    riskLabels: JSON.stringify(input.gate.riskLabels),
    confidence: input.gate.confidence,
    gateReasons: JSON.stringify(input.gate.reasons),
    status: input.gate.status,
    factSummary: input.normalized.originalSummary,
    barkLine: input.observation,
    speciesTags: JSON.stringify(input.normalized.speciesTags),
  };
  // 僅在缺 contentHash 時回填，不改寫既有 hash（audit-safe）
  if (!input.existing.contentHash) {
    data.contentHash = input.normalized.contentHash;
  }
  return data;
}

export async function findExistingMorningNews(
  db: MorningNewsPersistDb,
  normalized: NormalizedNewsCandidate,
): Promise<MorningNewsPersistRow | null> {
  return db.lineMorningNewsItem.findFirst({
    where: {
      OR: [
        { contentHash: normalized.contentHash },
        { fingerprint: normalized.contentHash },
        { canonicalUrl: normalized.canonicalUrl },
      ],
    },
    select: {
      id: true,
      fingerprint: true,
      contentHash: true,
      canonicalUrl: true,
      title: true,
      region: true,
      status: true,
      sourceId: true,
      sourceName: true,
    },
  });
}

/**
 * Idempotent persist：同 identity 更新可校正欄位；否則新建。
 * 回傳 'created' | 'updated'
 */
export async function persistNormalizedNewsItem(
  db: MorningNewsPersistDb,
  input: {
    normalized: NormalizedNewsCandidate;
    gate: GateResult;
    observation: string | null;
  },
): Promise<{ outcome: 'created' | 'updated'; row: MorningNewsPersistRow }> {
  const existing = await findExistingMorningNews(db, input.normalized);
  if (existing) {
    const data = buildNewsCorrectableUpdate({
      existing,
      normalized: input.normalized,
      gate: input.gate,
      observation: input.observation,
    });
    const row = await db.lineMorningNewsItem.update({
      where: { id: existing.id },
      data,
    });
    return { outcome: 'updated', row: { ...existing, ...row, region: input.gate.region } };
  }

  try {
    const row = await db.lineMorningNewsItem.create({
      data: {
        fingerprint: input.normalized.contentHash,
        contentHash: input.normalized.contentHash,
        canonicalUrl: input.normalized.canonicalUrl,
        sourceName: input.normalized.sourceName,
        sourceId: input.normalized.sourceId,
        publishedAt: input.normalized.publishedAt,
        fetchedAt: input.normalized.fetchedAt,
        region: input.gate.region,
        riskLevel: input.gate.riskLevel,
        status: input.gate.status,
        title: input.normalized.originalTitle,
        factSummary: input.normalized.originalSummary,
        barkLine: input.observation,
        riskLabels: JSON.stringify(input.gate.riskLabels),
        confidence: input.gate.confidence,
        speciesTags: JSON.stringify(input.normalized.speciesTags),
        gateReasons: JSON.stringify(input.gate.reasons),
      },
    });
    return {
      outcome: 'created',
      row: {
        id: String(row.id),
        fingerprint: input.normalized.contentHash,
        contentHash: input.normalized.contentHash,
        canonicalUrl: input.normalized.canonicalUrl,
        title: input.normalized.originalTitle,
        region: input.gate.region,
        status: input.gate.status,
        sourceId: input.normalized.sourceId,
        sourceName: input.normalized.sourceName,
      },
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // 競態：改找既有列並校正
      const raced = await findExistingMorningNews(db, input.normalized);
      if (!raced) throw e;
      const data = buildNewsCorrectableUpdate({
        existing: raced,
        normalized: input.normalized,
        gate: input.gate,
        observation: input.observation,
      });
      const row = await db.lineMorningNewsItem.update({
        where: { id: raced.id },
        data,
      });
      return {
        outcome: 'updated',
        row: { ...raced, ...row, region: input.gate.region },
      };
    }
    throw e;
  }
}

export async function ingestFixtureNewsPreview(opts?: {
  fixtures?: FixtureNewsRaw[];
  now?: Date;
  createdBy?: string | null;
  persist?: boolean;
  db?: MorningNewsPersistDb;
  /** 測試注入；未提供則讀 DB settings */
  settings?: { masterEnabled: boolean; dailyQuota: number };
}): Promise<IngestStats> {
  const now = opts?.now ?? new Date();
  const settings = opts?.settings ?? (await getMorningSettings());
  const fixtures = opts?.fixtures ?? buildFixtureNewsRaw(now);
  const persist = opts?.persist !== false;
  const db = opts?.db ?? (prisma as unknown as MorningNewsPersistDb);

  const reasonCounts: Record<string, number> = {};
  let fetchedCount = 0;
  let passedCount = 0;
  let blockedCount = 0;
  let duplicateCount = 0;
  let staleCount = 0;
  let reviewCount = 0;
  let updatedCount = 0;
  const passedPreview: IngestStats['passedPreview'] = [];

  void settings.masterEnabled;

  for (const raw of fixtures) {
    fetchedCount += 1;
    const normalized = normalizeNewsCandidate({
      sourceId: raw.sourceId,
      canonicalUrl: raw.canonicalUrl,
      originalTitle: raw.title,
      originalSummary: raw.summary,
      publishedAt: raw.publishedAt,
      speciesTags: raw.speciesTags,
      region: raw.region,
      now,
    });
    if (!normalized.ok) {
      bump(reasonCounts, normalized.reason);
      if (normalized.reason.includes('stale') || normalized.reason.includes('published')) {
        staleCount += 1;
      }
      blockedCount += 1;
      continue;
    }

    const gate = gateNormalizedNews(normalized.value);
    gate.reasons.forEach((r) => bump(reasonCounts, r));

    if (gate.status === 'BLOCKED') {
      blockedCount += 1;
    } else if (gate.status === 'REVIEW_REQUIRED') {
      reviewCount += 1;
      blockedCount += 1;
    }

    let observation =
      gate.status === 'AUTO_APPROVED' ? raw.safeObservation ?? null : null;
    const rendered =
      gate.status === 'AUTO_APPROVED'
        ? renderNewsInStyle({
            factSummary: normalized.value.originalSummary,
            observation,
            sourceName: normalized.value.sourceName,
            publishedAt: normalized.value.publishedAt,
            canonicalUrl: normalized.value.canonicalUrl,
          })
        : null;

    if (rendered) {
      const facts = assertNoInventedFacts(
        rendered.text,
        `${normalized.value.originalTitle}\n${normalized.value.originalSummary}`,
      );
      if (!facts.ok || !rendered.lint.ok) {
        blockedCount += 1;
        facts.issues.forEach((i) => bump(reasonCounts, i));
        rendered.lint.issues.forEach((i) => bump(reasonCounts, `style:${i}`));
        gate.status = 'BLOCKED';
        gate.reasons.push('style_or_fact_fail');
        observation = null;
      }
    }

    if (!persist) continue;

    // 寫入前再讀一次（測試可注入固定 settings）
    const settingsAgain = opts?.settings ?? (await getMorningSettings());
    void settingsAgain.masterEnabled;

    const result = await persistNormalizedNewsItem(db, {
      normalized: normalized.value,
      gate,
      observation,
    });

    if (result.outcome === 'updated') {
      duplicateCount += 1;
      updatedCount += 1;
      bump(reasonCounts, 'duplicate');
    } else if (isMorningNewsCandidate(gate) && rendered) {
      passedCount += 1;
      passedPreview.push({
        contentHash: normalized.value.contentHash,
        title: normalized.value.originalTitle,
        sourceName: normalized.value.sourceName,
        region: gate.region,
        renderedText: rendered.text,
      });
    }
  }

  const message =
    passedCount === 0 && updatedCount === 0
      ? '今天沒有通過安全檢查的新鮮事'
      : `通過 ${passedCount} 則安全候選／校正 ${updatedCount} 則（Preview only）`;

  if (persist) {
    const runDb = db.lineMorningIngestRun
      ? db
      : (prisma as unknown as MorningNewsPersistDb);
    if (runDb.lineMorningIngestRun) {
      await runDb.lineMorningIngestRun.create({
        data: {
          mode: 'fixture',
          masterEnabled: settings.masterEnabled,
          fetchedCount,
          passedCount,
          blockedCount,
          duplicateCount,
          staleCount,
          summaryJson: JSON.stringify({
            reasonCounts,
            reviewCount,
            updatedCount,
            note: 'preview_fixture_ingest',
          }),
          createdBy: opts?.createdBy ?? null,
        },
      });
    }
  }

  return {
    fetchedCount,
    passedCount,
    blockedCount,
    duplicateCount,
    staleCount,
    reviewCount,
    reasonCounts,
    updatedCount,
    passedPreview,
    message,
  };
}

export async function countNewsByContentHash(contentHash: string): Promise<number> {
  return prisma.lineMorningNewsItem.count({ where: { contentHash } });
}
