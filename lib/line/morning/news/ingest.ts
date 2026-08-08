/**
 * Fixture → normalize → gate → preview DB（idempotent）
 * 禁止 LINE API；禁止對 enabled=false 來源做真實網路抓取。
 */

import { prisma } from '@/lib/prisma';
import { getMorningSettings } from '@/lib/line/morning/settings';
import { gateNormalizedNews, isMorningNewsCandidate } from '@/lib/line/morning/news/gate';
import { normalizeNewsCandidate } from '@/lib/line/morning/news/normalize';
import {
  FIXTURE_NEWS_RAW,
  type FixtureNewsRaw,
} from '@/lib/line/morning/news/mock-feed';
import { renderNewsInStyle, assertNoInventedFacts } from '@/lib/line/morning/style';
import { Prisma } from '@prisma/client';

export type IngestStats = {
  fetchedCount: number;
  passedCount: number;
  blockedCount: number;
  duplicateCount: number;
  staleCount: number;
  reviewCount: number;
  reasonCounts: Record<string, number>;
  passedPreview: Array<{
    contentHash: string;
    title: string;
    sourceName: string;
    region: string;
    renderedText: string;
  }>;
  message: string;
};

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export async function ingestFixtureNewsPreview(opts?: {
  fixtures?: FixtureNewsRaw[];
  now?: Date;
  createdBy?: string | null;
  /** 執行前／寫入前皆檢查；OFF 時仍可預覽閘門結果但不寫入 AUTO_APPROVED 以外？ 規格：kill switch 預設 OFF，Preview refresh 仍可跑統計 */
  persist?: boolean;
}): Promise<IngestStats> {
  const now = opts?.now ?? new Date();
  const settings = await getMorningSettings(); // 執行前檢查
  const fixtures = opts?.fixtures ?? FIXTURE_NEWS_RAW;
  const persist = opts?.persist !== false;

  const reasonCounts: Record<string, number> = {};
  let fetchedCount = 0;
  let passedCount = 0;
  let blockedCount = 0;
  let duplicateCount = 0;
  let staleCount = 0;
  let reviewCount = 0;
  const passedPreview: IngestStats['passedPreview'] = [];

  // 寫入前再檢查一次 kill switch 語意：masterEnabled=false 不代表不能 Preview 統計
  // 但不得「當成可發送候選」；此處 Preview-only，一律不 LINE 發送。
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
      blockedCount += 1; // 不進晨間候選
    }

    const observation =
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
        passedCount = Math.max(0, passedCount);
        facts.issues.forEach((i) => bump(reasonCounts, i));
        rendered.lint.issues.forEach((i) => bump(reasonCounts, `style:${i}`));
        // 降為 BLOCKED 寫入
        gate.status = 'BLOCKED';
        gate.reasons.push('style_or_fact_fail');
      }
    }

    if (!persist) continue;

    const settingsAgain = await getMorningSettings(); // 寫入前再檢查
    void settingsAgain.masterEnabled;

    const existing = await prisma.lineMorningNewsItem.findUnique({
      where: { contentHash: normalized.value.contentHash },
      select: { id: true },
    });
    if (existing) {
      duplicateCount += 1;
      bump(reasonCounts, 'duplicate');
      await prisma.lineMorningNewsItem.update({
        where: { contentHash: normalized.value.contentHash },
        data: {
          status: gate.status,
          riskLevel: gate.riskLevel,
          riskLabels: JSON.stringify(gate.riskLabels),
          confidence: gate.confidence,
          gateReasons: JSON.stringify(gate.reasons),
          fetchedAt: normalized.value.fetchedAt,
          factSummary: normalized.value.originalSummary,
          barkLine: observation,
        },
      });
      continue;
    }

    try {
      await prisma.lineMorningNewsItem.create({
        data: {
          fingerprint: normalized.value.contentHash,
          contentHash: normalized.value.contentHash,
          canonicalUrl: normalized.value.canonicalUrl,
          sourceName: normalized.value.sourceName,
          sourceId: normalized.value.sourceId,
          publishedAt: normalized.value.publishedAt,
          fetchedAt: normalized.value.fetchedAt,
          region: gate.region,
          riskLevel: gate.riskLevel,
          status: gate.status,
          title: normalized.value.originalTitle,
          factSummary: normalized.value.originalSummary,
          barkLine: observation,
          riskLabels: JSON.stringify(gate.riskLabels),
          confidence: gate.confidence,
          speciesTags: JSON.stringify(normalized.value.speciesTags),
          gateReasons: JSON.stringify(gate.reasons),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        duplicateCount += 1;
        bump(reasonCounts, 'duplicate');
        continue;
      }
      throw e;
    }

    if (isMorningNewsCandidate(gate) && rendered) {
      passedCount += 1;
      passedPreview.push({
        contentHash: normalized.value.contentHash,
        title: normalized.value.originalTitle,
        sourceName: normalized.value.sourceName,
        region: gate.region,
        renderedText: rendered.text,
      });
    } else if (gate.status === 'AUTO_APPROVED' && !rendered) {
      // style fail 已在上方改 BLOCKED
    }
  }

  // 以 contentHash 再掃一次計算 duplicate：同 job 內 fixtures 重複
  // （上方 P2002 已計）

  const message =
    passedCount === 0
      ? '今天沒有通過安全檢查的新鮮事'
      : `通過 ${passedCount} 則安全候選（Preview only）`;

  if (persist) {
    await prisma.lineMorningIngestRun.create({
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
          note: 'preview_fixture_ingest',
        }),
        createdBy: opts?.createdBy ?? null,
      },
    });
  }

  return {
    fetchedCount,
    passedCount,
    blockedCount,
    duplicateCount,
    staleCount,
    reviewCount,
    reasonCounts,
    passedPreview,
    message,
  };
}

/** 同 job 重跑零新增：以 contentHash unique 保證 */
export async function countNewsByContentHash(contentHash: string): Promise<number> {
  return prisma.lineMorningNewsItem.count({ where: { contentHash } });
}
